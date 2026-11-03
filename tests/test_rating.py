import bot.rating as rating
from bot.rating import Match, compute_ratings, matches_from_rows, multiplier_pct, rating_change


def test_multiplier_is_clamped_and_only_for_the_lower_rated_player():
    assert multiplier_pct(500, 500) == 100
    assert multiplier_pct(500, 525) == 100
    assert multiplier_pct(500, 600) == 100
    assert multiplier_pct(500, 642) == 142
    assert multiplier_pct(500, 650) == 150
    assert multiplier_pct(500, 700) == 200
    assert multiplier_pct(500, 750) == 200
    assert multiplier_pct(642, 500) == 100  # higher-rated always 1.0


def test_example_1_underdog_wins_2_1():
    assert rating_change(500, 642, 2, 1) == 96
    assert rating_change(642, 500, 1, 2) == 0


def test_example_2_equal_ratings_2_0():
    assert rating_change(500, 500, 2, 0) == 75
    assert rating_change(500, 500, 0, 2) == -25


def test_example_3_favourite_wins_2_0():
    assert rating_change(500, 642, 0, 2) == -25
    assert rating_change(642, 500, 2, 0) == 75


def test_example_4_maximum_multiplier():
    assert rating_change(500, 750, 2, 1) == 125
    assert rating_change(750, 500, 1, 2) == 0


def test_draw_gives_game_points_without_match_bonus():
    assert rating_change(500, 500, 1, 1) == 25
    assert rating_change(500, 500, 0, 0) == 0


def test_fractional_change_rounds_half_up():
    # 1 game x 25 x 1.02 = 25.5 -> 26, minus the 25 loss penalty -> 1.
    assert rating_change(500, 602, 1, 2) == 1
    # 1 game x 25 x 1.01 = 25.25 -> 25 total 0.
    assert rating_change(500, 601, 1, 2) == 0


def test_compute_ratings_updates_round_by_round_and_records_history():
    matches = [
        Match(1, 1, 1, "a", 2, "b", 0),    # a 575, b 475
        Match(1, 2, 1, "b", 2, "a", 1),    # b underdog by 100 -> mult 1.0: +75 -> 550; a +0 -> 575
    ]
    ratings, history = compute_ratings(matches, players={"a", "b", "bye-only"})
    assert ratings == {"a": 575, "b": 550, "bye-only": 500}
    assert [(h.player_key, h.rating_before, h.rating_change, h.rating_after) for h in history] == [
        ("a", 500, 75, 575), ("b", 500, -25, 475),
        ("b", 475, 75, 550), ("a", 575, 0, 575),
    ]
    assert history[2].multiplier == 1.0


def test_matches_from_rows_dedupes_pairings_skips_byes_and_orders_by_date():
    rows = [
        {"tournament_id": 2, "round": 1, "pairing": 1, "player_key": "a", "game_wins": 2,
         "opponent_key": "b", "opponent_game_wins": 0, "event_date": "2026-08-08"},
        {"tournament_id": 2, "round": 1, "pairing": 1, "player_key": "b", "game_wins": 0,
         "opponent_key": "a", "opponent_game_wins": 2, "event_date": "2026-08-08"},
        {"tournament_id": 1, "round": 1, "pairing": 1, "player_key": "c", "game_wins": 1,
         "opponent_key": "a", "opponent_game_wins": 2, "event_date": "2026-08-01"},
        {"tournament_id": 1, "round": 1, "pairing": 2, "player_key": "b", "game_wins": None,
         "opponent_key": None, "opponent_game_wins": None, "event_date": "2026-08-01"},
        {"tournament_id": 3, "round": 1, "pairing": 1, "player_key": "x", "game_wins": None,
         "opponent_key": "y", "opponent_game_wins": None, "event_date": "2026-01-01"},
    ]
    matches = matches_from_rows(rows)
    assert [(m.tournament_id, m.player_key, m.opponent_key) for m in matches] == [
        (1, "c", "a"), (2, "a", "b"),
    ]


class FakeStore:
    def __init__(self, rows):
        self.rows = rows
        self.saved = None

    def fetch_all_round_results(self):
        return self.rows

    def save_ratings(self, ratings, history):
        self.saved = (ratings, history)


def test_run_recomputes_from_all_rows_and_saves():
    rows = [
        {"tournament_id": 1, "round": 1, "pairing": 1, "player_key": "a", "game_wins": 2,
         "opponent_key": "b", "opponent_game_wins": 1, "event_date": "2026-08-01"},
        {"tournament_id": 1, "round": 1, "pairing": 1, "player_key": "b", "game_wins": 1,
         "opponent_key": "a", "opponent_game_wins": 2, "event_date": "2026-08-01"},
        {"tournament_id": 1, "round": 1, "pairing": 2, "player_key": "c", "game_wins": None,
         "opponent_key": None, "opponent_game_wins": None, "event_date": "2026-08-01"},
    ]
    store = FakeStore(rows)
    assert rating.run(store) == 3
    ratings, history = store.saved
    assert ratings == {"a": 575, "b": 500, "c": 500}
    assert len(history) == 2
