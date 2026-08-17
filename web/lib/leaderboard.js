import { seasonKey } from './season.js';

function playerEntry(player) {
  return { record: player.record, isLeague: player.is_league !== false };
}

export function finalRecords(tournament) {
  const last = {};
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      last[pairing.player1.name] = playerEntry(pairing.player1);
      if (pairing.player2) {
        last[pairing.player2.name] = playerEntry(pairing.player2);
      }
    }
  }
  return last;
}

export function points(record) {
  return record.wins * 3 + record.draws;
}

function accumulate(stats, player, pairing) {
  const s = stats[player.name] || { record: null, gameWins: 0, isLeague: true };
  s.record = player.record; // rounds are in order, so this ends as the final record
  s.gameWins += player.game_wins || 0;
  s.isLeague = player.is_league !== false;
  s.pairing = pairing; // rounds are in order, so this ends as the final pairing
  stats[player.name] = s;
}

export function playerTournamentStats(tournament) {
  const stats = {};
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      accumulate(stats, pairing.player1, pairing.pairing);
      if (pairing.player2) accumulate(stats, pairing.player2, pairing.pairing);
    }
  }
  return stats;
}

const ORD = ['1st', '2nd', '3rd'];

function plural(n, word) {
  return `${n} ${n === 1 ? word : word + 's'}`;
}

// Standings-shaped events store the organiser's final ranking in `pairing`, one
// player per pairing. That ranking already accounts for tiebreakers the data does
// not carry (OMW%/GW%/OGW%), so it is authoritative. In pairing-shaped events two
// players share a `pairing` — it is a table number, not a rank — so the order has
// to be derived from the records instead.
function rankPlayers(players) {
  const pairings = players.map(p => p.pairing);
  const isStandings =
    pairings.every(p => p !== undefined && p !== null) &&
    new Set(pairings).size === players.length;
  if (isStandings) return [...players].sort((a, b) => a.pairing - b.pairing);
  return [...players].sort(
    (a, b) => b.mp - a.mp || b.gameWins - a.gameWins || a.name.localeCompare(b.name),
  );
}

export function tournamentScores(tournament) {
  const stats = playerTournamentStats(tournament);
  const summer = seasonKey(tournament.date) === '2026-2';
  const ranked = rankPlayers(
    Object.entries(stats).map(([name, s]) => ({ name, ...s, mp: points(s.record) })),
  );
  const bonus = [3, 2, 1];
  const scores = {};
  ranked.forEach((p, i) => {
    const items = [];
    if (summer) {
      if (i < 3) items.push({ label: `${ORD[i]} place`, points: bonus[i] });
      if (p.record.wins > 0) items.push({ label: `${plural(p.record.wins, 'win')} (×2)`, points: 2 * p.record.wins });
      if (p.record.draws > 0) items.push({ label: `${plural(p.record.draws, 'draw')} (×1)`, points: p.record.draws });
      items.push({ label: 'attendance', points: 1 });
    } else {
      if (p.record.wins > 0) items.push({ label: `${plural(p.record.wins, 'win')} (×3)`, points: 3 * p.record.wins });
      if (p.record.draws > 0) items.push({ label: `${plural(p.record.draws, 'draw')} (×1)`, points: p.record.draws });
    }
    const subtotal = items.reduce((sum, it) => sum + it.points, 0);
    scores[p.name] = {
      score: subtotal,
      isLeague: p.isLeague,
      breakdown: { tournament: tournament.name, date: tournament.date, items, subtotal },
    };
  });
  return scores;
}

function buildBoard(tournaments) {
  const agg = {};
  for (const tournament of tournaments) {
    const scored = tournamentScores(tournament);
    for (const [name, { score, isLeague, breakdown }] of Object.entries(scored)) {
      if (!isLeague) continue;
      if (!agg[name]) agg[name] = { name, points: 0, events: 0, breakdown: [] };
      agg[name].points += score;
      agg[name].events += 1;
      agg[name].breakdown.push(breakdown);
    }
  }
  return Object.values(agg).sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  );
}

export function seasonLeaderboard(tournaments, key) {
  return buildBoard(tournaments.filter(t => seasonKey(t.date) === key));
}

// The season board as it stood before the latest-dated tournament(s) in the
// season, for computing position movement. `hasPrevious` is false when the
// season has no earlier tournament to compare against.
export function seasonLeaderboardBefore(tournaments, key) {
  const inSeason = tournaments.filter(t => seasonKey(t.date) === key);
  if (inSeason.length === 0) return { rows: [], hasPrevious: false };
  const maxDate = inSeason.reduce((m, t) => (t.date > m ? t.date : m), inSeason[0].date);
  const earlier = inSeason.filter(t => t.date < maxDate);
  return { rows: buildBoard(earlier), hasPrevious: earlier.length > 0 };
}
