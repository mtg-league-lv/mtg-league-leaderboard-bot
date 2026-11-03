"""League rating (eloScore): pure calculation plus a `run` job over the Store.

Every player starts at 500. Each BO3 match changes both players' ratings by
``games_won * 25 * multiplier + match_bonus`` (bonus +25 win, -25 loss, 0 draw).
The lower-rated player's multiplier is ``clamp(diff / 100, 1.0, 2.0)``; the
higher-rated (or equal) player always uses 1.0. The change is rounded half up to
an integer. Ratings update match by match, so each round uses the ratings
produced by the previous one.

Arithmetic is kept in integers (multiplier as hundredths) so a ``.5`` change
always rounds the same way instead of depending on float error.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)

INITIAL_RATING = 500
GAME_WIN_POINTS = 25
MATCH_BONUS = 25
MIN_MULTIPLIER_PCT = 100  # 1.0
MAX_MULTIPLIER_PCT = 200  # 2.0


@dataclass(frozen=True)
class Match:
    tournament_id: int
    round: int
    pairing: int
    player_key: str
    player_games: int
    opponent_key: str
    opponent_games: int


@dataclass(frozen=True)
class RatingChange:
    tournament_id: int
    round: int
    pairing: int
    player_key: str
    opponent_key: str
    games_won: int
    opponent_games_won: int
    multiplier: float
    rating_before: int
    rating_change: int
    rating_after: int


def multiplier_pct(rating: int, opponent_rating: int) -> int:
    """Difficulty multiplier in hundredths (100 = 1.0)."""
    if rating >= opponent_rating:
        return MIN_MULTIPLIER_PCT
    diff = opponent_rating - rating
    return min(MAX_MULTIPLIER_PCT, max(MIN_MULTIPLIER_PCT, diff))


def rating_change(rating: int, opponent_rating: int, games_won: int, opponent_games: int) -> int:
    mult = multiplier_pct(rating, opponent_rating)
    if games_won > opponent_games:
        bonus = MATCH_BONUS
    elif games_won < opponent_games:
        bonus = -MATCH_BONUS
    else:
        bonus = 0
    hundredths = games_won * GAME_WIN_POINTS * mult + bonus * 100
    # Round half up (toward +infinity) on the exact integer value.
    return (hundredths + 50) // 100


def compute_ratings(
    matches: list[Match], players: set[str] | None = None
) -> tuple[dict[str, int], list[RatingChange]]:
    """Replay ``matches`` in the given (chronological) order.

    Returns every player's final rating (``players`` seeds extra players at the
    initial rating, e.g. those who only had byes) and the per-player audit trail.
    """
    ratings = {key: INITIAL_RATING for key in players or ()}
    history: list[RatingChange] = []
    for m in matches:
        a = ratings.setdefault(m.player_key, INITIAL_RATING)
        b = ratings.setdefault(m.opponent_key, INITIAL_RATING)
        sides = (
            (m.player_key, m.opponent_key, m.player_games, m.opponent_games, a, b),
            (m.opponent_key, m.player_key, m.opponent_games, m.player_games, b, a),
        )
        for key, opp, won, lost, own, theirs in sides:
            delta = rating_change(own, theirs, won, lost)
            ratings[key] = own + delta
            history.append(
                RatingChange(
                    tournament_id=m.tournament_id,
                    round=m.round,
                    pairing=m.pairing,
                    player_key=key,
                    opponent_key=opp,
                    games_won=won,
                    opponent_games_won=lost,
                    multiplier=multiplier_pct(own, theirs) / 100,
                    rating_before=own,
                    rating_change=delta,
                    rating_after=own + delta,
                )
            )
    return ratings, history


def matches_from_rows(rows: list[dict]) -> list[Match]:
    """Build chronological matches from ``round_results`` rows.

    Each pairing is stored once per player; keep one row per pairing. Byes and
    rows without game scores (legacy standings imports) are not rated. Rows need
    ``event_date`` (flattened from the tournament) for ordering.
    """
    seen: set[tuple] = set()
    matches: list[tuple] = []
    for r in rows:
        if r.get("opponent_key") is None or r.get("game_wins") is None:
            continue
        if r.get("opponent_game_wins") is None:
            continue
        key = (r["tournament_id"], r["round"], r["pairing"])
        if key in seen:
            continue
        seen.add(key)
        match = Match(
            tournament_id=r["tournament_id"],
            round=r["round"],
            pairing=r["pairing"],
            player_key=r["player_key"],
            player_games=r["game_wins"],
            opponent_key=r["opponent_key"],
            opponent_games=r["opponent_game_wins"],
        )
        matches.append((r["event_date"], r["tournament_id"], r["round"], r["pairing"], match))
    matches.sort(key=lambda t: t[:4])
    return [t[4] for t in matches]


def run(store) -> int:
    """Recalculate every player's eloScore from all recorded tournaments.

    A full replay (not an increment) so the result is the same however often it
    runs, and manual data fixes in Supabase are picked up. Returns the number of
    rated players.
    """
    rows = store.fetch_all_round_results()
    ratings, history = compute_ratings(
        matches_from_rows(rows), players={r["player_key"] for r in rows}
    )
    store.save_ratings(ratings, history)
    log.info("Ratings recalculated: %d players, %d rating changes", len(ratings), len(history))
    return len(ratings)
