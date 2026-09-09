import { points, rankPlayers } from './leaderboard.js';

// Each player's per-tournament stats, ordered the same way the leaderboard ranks
// them (official standing → pairing-as-rank → records). Mirrors finalStandings.
function tournamentOrder(tournament) {
  const byName = new Map();
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      for (const p of [pairing.player1, pairing.player2]) {
        if (!p) continue;
        const cur = byName.get(p.name) || { name: p.name, gameWins: 0 };
        cur.record = p.record;
        cur.gameWins += p.game_wins || 0;
        cur.pairing = pairing.pairing;
        if (p.standing != null) cur.standing = p.standing;
        byName.set(p.name, cur);
      }
    }
  }
  const players = [...byName.values()].map(p => ({ ...p, mp: points(p.record) }));
  return rankPlayers(players);
}

// The player's final record and deck within one tournament (null if absent).
function playerInTournament(tournament, name) {
  let found = null;
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      for (const p of [pairing.player1, pairing.player2]) {
        if (p && p.name === name) {
          found = found || { deck: null, deck_colours: null };
          found.record = p.record; // rounds in order → ends as final record
          if (p.deck) { found.deck = p.deck; found.deck_colours = p.deck_colours || null; }
        }
      }
    }
  }
  return found;
}

function topThree(counts, valueKey) {
  return [...counts.entries()]
    .map(([name, value]) => ({ name, [valueKey]: value }))
    .sort((a, b) => b[valueKey] - a[valueKey] || a.name.localeCompare(b.name))
    .slice(0, 3);
}

export function playerProfile(tournaments, name) {
  const placements = { first: 0, second: 0, third: 0 };
  const deckTournaments = new Map(); // deck -> { tournaments, colours }
  const losses = new Map();          // opponent -> match losses
  const games = new Map();           // opponent -> matches played
  const colourEvents = { W: 0, U: 0, B: 0, R: 0, G: 0 }; // tournaments whose deck used each colour
  let colouredEvents = 0;            // tournaments with a known deck colour
  const record = { wins: 0, draws: 0, losses: 0 };
  let attended = 0;

  for (const tournament of tournaments) {
    const here = playerInTournament(tournament, name);
    if (!here) continue;
    attended += 1;
    record.wins += here.record.wins;
    record.draws += here.record.draws;
    record.losses += here.record.losses;
    if (here.deck) {
      const entry = deckTournaments.get(here.deck) || { tournaments: 0, colours: here.deck_colours };
      entry.tournaments += 1;
      if (!entry.colours && here.deck_colours) entry.colours = here.deck_colours;
      deckTournaments.set(here.deck, entry);
    }
    // Colour usage counts each tournament once (independent of how many rounds are
    // stored), so round-based and standings-only events weigh the same.
    if (here.deck_colours) {
      colouredEvents += 1;
      for (const c of new Set(here.deck_colours.toUpperCase())) {
        if (c in colourEvents) colourEvents[c] += 1;
      }
    }

    const order = tournamentOrder(tournament);
    const idx = order.findIndex(p => p.name === name);
    if (idx === 0) placements.first += 1;
    else if (idx === 1) placements.second += 1;
    else if (idx === 2) placements.third += 1;

    for (const round of tournament.rounds) {
      for (const pairing of round.pairings) {
        const { player1: p1, player2: p2 } = pairing;
        if (!p1 || !p2) continue; // byes have no opponent
        let me, opp;
        if (p1.name === name) { me = p1; opp = p2; }
        else if (p2.name === name) { me = p2; opp = p1; }
        else continue;
        games.set(opp.name, (games.get(opp.name) || 0) + 1);
        if ((me.game_wins || 0) < (opp.game_wins || 0)) {
          losses.set(opp.name, (losses.get(opp.name) || 0) + 1);
        }
      }
    }
  }

  const decks = [...deckTournaments.entries()]
    .map(([deck, { tournaments, colours }]) => ({ deck, colours: colours || null, tournaments }))
    .sort((a, b) => b.tournaments - a.tournaments || a.deck.localeCompare(b.deck));

  // Most-played colour(s): the colour(s) used in the most tournaments, with the
  // share of tournaments rounded to a whole percent. Ties list every leading colour.
  const ORDER = ['W', 'U', 'B', 'R', 'G'];
  const maxColour = Math.max(0, ...ORDER.map(c => colourEvents[c]));
  const colours = colouredEvents > 0 && maxColour > 0
    ? { top: ORDER.filter(c => colourEvents[c] === maxColour), pct: Math.round((maxColour / colouredEvents) * 100) }
    : { top: [], pct: 0 };

  return {
    tournaments: attended,
    record,
    placements,
    colours,
    decks,
    rivals: topThree(losses, 'losses'),
    friends: topThree(games, 'games'),
  };
}
