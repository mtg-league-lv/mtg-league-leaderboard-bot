from __future__ import annotations

from datetime import date

from bot.parser import PlayerRound
from bot.rating import RatingChange

PAGE_SIZE = 1000
WRITE_CHUNK = 500


class Store:
    def __init__(self, supabase) -> None:
        self._db = supabase

    def existing_message_ids(self, ids: list[str]) -> set[str]:
        if not ids:
            return set()
        resp = (
            self._db.table("tournaments")
            .select("discord_message_id")
            .in_("discord_message_id", ids)
            .execute()
        )
        return {row["discord_message_id"] for row in resp.data}

    def upsert_players(self, players: list[dict]) -> None:
        if not players:
            return
        self._db.table("players").upsert(
            players, on_conflict="player_key", ignore_duplicates=True
        ).execute()

    def fetch_league_keys(self) -> set[str]:
        resp = (
            self._db.table("players").select("player_key").eq("is_league", True).execute()
        )
        return {row["player_key"] for row in resp.data}

    def insert_tournament(
        self,
        message_id: str,
        channel_id: str,
        name: str,
        event_date: date,
        rounds: list[PlayerRound],
    ) -> None:
        resp = (
            self._db.table("tournaments")
            .insert(
                {
                    "discord_message_id": message_id,
                    "name": name,
                    "event_date": event_date.isoformat(),
                    "channel_id": channel_id,
                }
            )
            .execute()
        )
        tournament_id = resp.data[0]["id"]
        rows = [
            {
                "tournament_id": tournament_id,
                "round": r.round,
                "pairing": r.pairing,
                "player_name": r.player_name,
                "player_key": r.player_key,
                "opponent_name": r.opponent_name,
                "opponent_key": r.opponent_key,
                "game_wins": r.game_wins,
                "opponent_game_wins": r.opponent_game_wins,
                "record_wins": r.record_wins,
                "record_draws": r.record_draws,
                "record_losses": r.record_losses,
            }
            for r in rounds
        ]
        self._db.table("round_results").insert(rows).execute()

    def fetch_tournament_stats(self, start: date, end: date) -> list[dict]:
        resp = (
            self._db.table("round_results")
            .select(
                "tournament_id, round, pairing, final_rank, player_key, player_name, game_wins, "
                "record_wins, record_draws, tournaments!inner(event_date)"
            )
            .gte("tournaments.event_date", start.isoformat())
            .lte("tournaments.event_date", end.isoformat())
            .order("event_date", desc=False, foreign_table="tournaments")
            .execute()
        )
        reduced: dict[tuple, dict] = {}
        for row in resp.data:
            key = (row["tournament_id"], row["player_key"])
            cur = reduced.get(key)
            if cur is None:
                reduced[key] = {
                    "tournament_id": row["tournament_id"],
                    "event_date": row["tournaments"]["event_date"],
                    "player_key": row["player_key"],
                    "player_name": row["player_name"],
                    "record_wins": row["record_wins"],
                    "record_draws": row["record_draws"],
                    "game_wins": row["game_wins"] or 0,
                    "pairing": row.get("pairing"),
                    "final_rank": row.get("final_rank"),
                    "_round": row["round"],
                }
            else:
                cur["game_wins"] += row["game_wins"] or 0
                if cur.get("final_rank") is None and row.get("final_rank") is not None:
                    cur["final_rank"] = row["final_rank"]
                if row["round"] > cur["_round"]:
                    cur["_round"] = row["round"]
                    cur["record_wins"] = row["record_wins"]
                    cur["record_draws"] = row["record_draws"]
                    cur["player_name"] = row["player_name"]
                    cur["pairing"] = row.get("pairing")
        return [{k: v for k, v in r.items() if k != "_round"} for r in reduced.values()]

    def fetch_results_in_window(self, start: date, end: date) -> list[dict]:
        resp = (
            self._db.table("round_results")
            .select(
                "tournament_id, round, player_key, player_name, "
                "record_wins, record_draws, tournaments!inner(event_date)"
            )
            .gte("tournaments.event_date", start.isoformat())
            .lte("tournaments.event_date", end.isoformat())
            .order("event_date", desc=False, foreign_table="tournaments")
            .execute()
        )
        # Reduce to each player's final-round record per tournament, then points = 3W + D.
        finals: dict[tuple, dict] = {}
        for row in resp.data:
            key = (row["tournament_id"], row["player_key"])
            current = finals.get(key)
            if current is None or row["round"] > current["round"]:
                finals[key] = row
        return [
            {
                "player_key": row["player_key"],
                "player_name": row["player_name"],
                "points": 3 * row["record_wins"] + row["record_draws"],
            }
            for row in finals.values()
        ]

    def fetch_all_round_results(self) -> list[dict]:
        """Every round_results row needed for ratings, with event_date flattened.

        Paged explicitly: PostgREST caps a single response at ~1000 rows.
        """
        rows: list[dict] = []
        start = 0
        while True:
            resp = (
                self._db.table("round_results")
                .select(
                    "tournament_id, round, pairing, player_key, game_wins, "
                    "opponent_key, opponent_game_wins, tournaments!inner(event_date)"
                )
                .order("id")
                .range(start, start + PAGE_SIZE - 1)
                .execute()
            )
            for row in resp.data:
                rows.append({**row, "event_date": row["tournaments"]["event_date"]})
            if len(resp.data) < PAGE_SIZE:
                return rows
            start += PAGE_SIZE

    def save_ratings(self, ratings: dict[str, int], history: list[RatingChange]) -> None:
        """Write each player's elo_score and replace the rating audit trail."""
        players = [{"player_key": k, "elo_score": v} for k, v in sorted(ratings.items())]
        for i in range(0, len(players), WRITE_CHUNK):
            self._db.table("players").upsert(
                players[i : i + WRITE_CHUNK], on_conflict="player_key"
            ).execute()
        # Full recompute: drop the old trail (delete needs a filter) and rewrite it.
        self._db.table("rating_changes").delete().gte("id", 0).execute()
        rows = [
            {
                "tournament_id": h.tournament_id,
                "round": h.round,
                "pairing": h.pairing,
                "player_key": h.player_key,
                "opponent_key": h.opponent_key,
                "games_won": h.games_won,
                "opponent_games_won": h.opponent_games_won,
                "multiplier": h.multiplier,
                "rating_before": h.rating_before,
                "rating_change": h.rating_change,
                "rating_after": h.rating_after,
            }
            for h in history
        ]
        for i in range(0, len(rows), WRITE_CHUNK):
            self._db.table("rating_changes").insert(rows[i : i + WRITE_CHUNK]).execute()
