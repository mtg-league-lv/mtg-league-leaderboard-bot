// Pure port of bot/export.py build_site_data. Given raw Supabase rows, produce
// the { tournaments: [...] } shape the views already consume. Keep this in step
// with bot/export.py so live reads and the (legacy) JSON export never diverge.

function playerObj(row, leagueKeys) {
  return {
    name: row.player_name,
    game_wins: row.game_wins,
    record: {
      wins: row.record_wins,
      draws: row.record_draws,
      losses: row.record_losses,
    },
    is_league: leagueKeys == null ? true : leagueKeys.has(row.player_key),
    deck: row.player_deck ?? null,
    deck_colours: row.player_deck_colours ?? null,
    standing: row.final_rank ?? null,
  };
}

export function buildSiteData(tournaments, results, leagueKeys = null) {
  // grouped: tournament_id -> round -> pairing -> [rows]
  const grouped = new Map();
  for (const row of results) {
    if (!grouped.has(row.tournament_id)) grouped.set(row.tournament_id, new Map());
    const rounds = grouped.get(row.tournament_id);
    if (!rounds.has(row.round)) rounds.set(row.round, new Map());
    const pairings = rounds.get(row.round);
    if (!pairings.has(row.pairing)) pairings.set(row.pairing, []);
    pairings.get(row.pairing).push(row);
  }

  const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const byNumber = (a, b) => a - b;

  const outTournaments = [];
  for (const t of [...tournaments].sort((a, b) => byString(a.event_date, b.event_date))) {
    const roundsMap = grouped.get(t.id) ?? new Map();
    const roundsOut = [];
    for (const roundNo of [...roundsMap.keys()].sort(byNumber)) {
      const pairingsMap = roundsMap.get(roundNo);
      const pairingsOut = [];
      for (const pairingNo of [...pairingsMap.keys()].sort(byNumber)) {
        const rows = [...pairingsMap.get(pairingNo)].sort((a, b) =>
          byString(a.player_key, b.player_key),
        );
        pairingsOut.push({
          pairing: pairingNo,
          player1: playerObj(rows[0], leagueKeys),
          player2: rows.length > 1 ? playerObj(rows[1], leagueKeys) : null,
        });
      }
      roundsOut.push({ round: roundNo, pairings: pairingsOut });
    }
    outTournaments.push({
      id: String(t.id),
      name: t.name || 'Tournament',
      date: t.event_date,
      rounds: roundsOut,
    });
  }
  return { tournaments: outTournaments };
}

export function achievementsByName(achievements, results, players) {
  const byKey = new Map();
  for (const a of achievements) {
    if (!byKey.has(a.player_key)) byKey.set(a.player_key, []);
    byKey.get(a.player_key).push(a.label);
  }
  const byName = new Map();
  const attach = (name, key) => {
    if (name == null) return;
    const labels = byKey.get(key);
    if (labels) byName.set(name, labels);
  };
  for (const r of results) attach(r.player_name, r.player_key);
  for (const p of players) attach(p.display_name, p.player_key);
  return byName;
}

// eloScore by display name, matched the same way as achievements (any name a
// player_key appears under in results, plus the roster display name).
export function ratingsByName(ratings, results, players) {
  const byKey = new Map(
    ratings.filter(r => r.elo_score != null).map(r => [r.player_key, r.elo_score]),
  );
  const byName = new Map();
  const attach = (name, key) => {
    if (name != null && byKey.has(key)) byName.set(name, byKey.get(key));
  };
  for (const r of results) attach(r.player_name, r.player_key);
  for (const p of players) attach(p.display_name, p.player_key);
  return byName;
}

// eloScore audit trail by display name, newest first. Each entry:
// { tournament, date, round, opponent, gamesWon, opponentGamesWon, multiplier,
//   before, change, after }. Names resolve like achievements; a tournament
// missing from `tournaments` falls back to its id.
export function ratingHistoryByName(changes, results, players, tournaments) {
  const nameByKey = new Map();
  for (const r of results) nameByKey.set(r.player_key, r.player_name);
  for (const p of players) if (p.display_name) nameByKey.set(p.player_key, p.display_name);
  const tById = new Map(tournaments.map(t => [String(t.id), t]));

  const byKey = new Map();
  for (const c of changes) {
    const t = tById.get(String(c.tournament_id));
    if (!byKey.has(c.player_key)) byKey.set(c.player_key, []);
    byKey.get(c.player_key).push({
      tournamentId: String(c.tournament_id),
      tournament: t?.name ?? `Tournament ${c.tournament_id}`,
      date: t?.date ?? '',
      round: c.round,
      opponent: nameByKey.get(c.opponent_key) ?? c.opponent_key,
      gamesWon: c.games_won,
      opponentGamesWon: c.opponent_games_won,
      multiplier: Number(c.multiplier),
      before: c.rating_before,
      change: c.rating_change,
      after: c.rating_after,
    });
  }
  const newestFirst = (a, b) =>
    (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
    Number(b.tournamentId) - Number(a.tournamentId) || b.round - a.round;
  for (const list of byKey.values()) list.sort(newestFirst);

  const byName = new Map();
  const attach = (name, key) => {
    if (name != null && byKey.has(key)) byName.set(name, byKey.get(key));
  };
  for (const r of results) attach(r.player_name, r.player_key);
  for (const p of players) attach(p.display_name, p.player_key);
  return byName;
}
