import bot.__main__ as cli


def test_build_arg_parser_accepts_commands():
    parser = cli.build_parser()
    assert parser.parse_args(["ingest"]).command == "ingest"
    assert parser.parse_args(["leaderboard"]).command == "leaderboard"


def test_main_dispatches_ingest(monkeypatch):
    called = {}
    monkeypatch.setattr(cli, "_run_ingest", lambda cfg: called.setdefault("ingest", True))
    monkeypatch.setattr(cli, "load_config", lambda: object())
    cli.main(["ingest"])
    assert called == {"ingest": True}


def test_main_dispatches_leaderboard(monkeypatch):
    called = {}
    monkeypatch.setattr(cli, "_run_leaderboard", lambda cfg: called.setdefault("lb", True))
    monkeypatch.setattr(cli, "load_config", lambda: object())
    cli.main(["leaderboard"])
    assert called == {"lb": True}


def test_main_dispatches_ratings(monkeypatch):
    called = {}
    monkeypatch.setattr(cli, "_run_ratings", lambda cfg: called.setdefault("ratings", True))
    monkeypatch.setattr(cli, "load_config", lambda: object())
    cli.main(["ratings"])
    assert called == {"ratings": True}


def test_ingest_recalculates_ratings_only_when_tournaments_were_added(monkeypatch):
    for count, expected in [(0, []), (2, ["store"])]:
        recalculated = []
        monkeypatch.setattr(cli, "_make_clients", lambda cfg: ("discord", "store"))
        monkeypatch.setattr(cli, "ingest_run", lambda *a, count=count: count)
        monkeypatch.setattr(cli, "ratings_run", recalculated.append)
        cfg = type("Cfg", (), {"results_channel_id": "1", "timezone": "Europe/Riga"})()
        cli._run_ingest(cfg)
        assert recalculated == expected
