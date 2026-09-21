import { points, rankPlayers } from '../lib/leaderboard.js';
import { playerLink } from './player-link.js';
import { manaIcons } from './mana.js';
import { titleCase } from '../lib/deck.js';

function recordChip(record) {
  return `<span class="chip">${record.wins}-${record.draws}-${record.losses}</span>`;
}

const PIPS = ['W', 'U', 'B', 'R', 'G'];

// The linked viewer's own deck for this event. `entry` = { name, deck,
// deck_colours }; editable → a pip+name form, else a read-only display.
export function renderYouvePlayed(entry, editable) {
  const label = '<div class="section-label">You\'ve played</div>';
  if (editable) {
    const selected = new Set((entry.deck_colours || '').split(''));
    const pips = PIPS.map(c =>
      `<button type="button" class="pip-toggle${selected.has(c) ? ' selected' : ''}" ` +
      `data-pip="${c}" aria-pressed="${selected.has(c)}" aria-label="${c}">` +
      `<img src="icons/mana/${c}.svg" alt="${c}" /></button>`,
    ).join('');
    return (
      label +
      '<div class="youve-played editing">' +
      `<div class="pip-row">${pips}</div>` +
      `<input id="deck-name" class="deck-name-input" type="text" maxlength="60" ` +
      `placeholder="Deck name" value="${entry.deck ? entry.deck.replace(/"/g, '&quot;') : ''}" />` +
      '<button id="deck-save" class="auth-signin" type="button">Save</button>' +
      '<span id="deck-status" class="deck-status" role="status"></span>' +
      '</div>'
    );
  }
  const body = (entry.deck || entry.deck_colours)
    ? `<span class="deck-info">${manaIcons(entry.deck_colours)}` +
      `${entry.deck ? `<span class="deck-name">${titleCase(entry.deck)}</span>` : ''}</span>`
    : '<span class="profile-empty">No deck recorded yet</span>';
  return label + `<div class="youve-played">${body}</div>`;
}

const MARK = '<span class="mark">✓</span>';

function deckInfo(player) {
  const icons = manaIcons(player.deck_colours);
  const name = player.deck ? `<span class="deck-name">${titleCase(player.deck)}</span>` : '';
  const inner = icons + name;
  // Group pips + name so it can move to its own line on narrow screens.
  return inner ? `<span class="deck-info">${inner}</span>` : '';
}

function leagueTag(player) {
  return player.is_league === false
    ? '<span class="non-league">Not from League</span>'
    : '';
}

function pairingRow(pairing) {
  const p1 = pairing.player1;
  if (!pairing.player2) {
    return (
      `<div class="pairing bye">` +
      `<div class="side win">${MARK}${playerLink(p1.name, "name")}${deckInfo(p1)}${leagueTag(p1)}${recordChip(p1.record)}</div>` +
      `<div class="score">Bye</div>` +
      `<div class="side right"></div>` +
      `</div>`
    );
  }
  const p2 = pairing.player2;
  const p1Won = p1.game_wins > p2.game_wins;
  const p2Won = p2.game_wins > p1.game_wins;
  return (
    `<div class="pairing">` +
    `<div class="side ${p1Won ? 'win' : ''}">${p1Won ? MARK : ''}${playerLink(p1.name, "name")}${deckInfo(p1)}${leagueTag(p1)}${recordChip(p1.record)}</div>` +
    `<div class="score">${p1.game_wins}-${p2.game_wins}</div>` +
    `<div class="side right ${p2Won ? 'win' : ''}">${recordChip(p2.record)}${playerLink(p2.name, "name")}${deckInfo(p2)}${leagueTag(p2)}${p2Won ? MARK : ''}</div>` +
    `</div>`
  );
}

function isStandingsEvent(tournament) {
  const pairings = tournament.rounds.flatMap(round => round.pairings);
  return pairings.length > 0 && pairings.every(pairing => pairing.player2 === null);
}

// Each player's final standing: their last record, summed game wins, deck and
// league flag, ordered the same way the leaderboard ranks them (official
// `standing` → `pairing`-as-rank for standings-shaped events → records).
function finalStandings(tournament) {
  const byName = new Map();
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      for (const p of [pairing.player1, pairing.player2]) {
        if (!p) continue;
        const cur = byName.get(p.name) || { name: p.name, gameWins: 0 };
        cur.record = p.record; // rounds are in order, so this ends as the final record
        cur.gameWins += p.game_wins || 0;
        cur.is_league = p.is_league;
        cur.deck = p.deck;
        cur.deck_colours = p.deck_colours;
        cur.pairing = pairing.pairing;
        if (p.standing != null) cur.standing = p.standing;
        byName.set(p.name, cur);
      }
    }
  }
  const players = [...byName.values()].map(p => ({ ...p, mp: points(p.record) }));
  return rankPlayers(players).map((player, i) => ({ rank: i + 1, player }));
}

function renderStandingsTable(rows) {
  const head =
    '<div class="row head"><div>#</div><div>Player</div>' +
    '<div class="num">Record</div><div class="num">Points</div></div>';
  const body = rows
    .map(({ rank, player }) => {
      const r = player.record;
      return (
        `<div class="row">` +
        `<div class="rank">${rank}</div>` +
        `<div class="player">${playerLink(player.name, "pname")}${deckInfo(player)}${leagueTag(player)}</div>` +
        `<div class="num">${r.wins}-${r.draws}-${r.losses}</div>` +
        `<div class="num strong">${points(r)}</div>` +
        `</div>`
      );
    })
    .join('');
  return `<div class="standings">${head + body}</div>`;
}

function tournamentHeader(tournament, meta) {
  return (
    `<div class="t-header"><div class="t-name">${tournament.name}</div>` +
    `<div class="t-meta">${tournament.date} · ${meta}</div></div>`
  );
}

export function renderTournament(tournament, viewer = null) {
  const standings = finalStandings(tournament);
  const mine = viewer && standings.find(s => s.player.name === viewer.name);
  const youvePlayed = mine
    ? renderYouvePlayed(
        { name: mine.player.name, deck: mine.player.deck, deck_colours: mine.player.deck_colours },
        viewer.editable,
      )
    : '';
  // Standings-only events (legacy imports) have no round-by-round detail.
  if (isStandingsEvent(tournament)) {
    return tournamentHeader(tournament, `${standings.length} players`) +
      youvePlayed +
      renderStandingsTable(standings);
  }
  const rounds = tournament.rounds
    .map(round => {
      const pairings = round.pairings.map(pairingRow).join('');
      return `<div class="round-label">Round ${round.round}</div>${pairings}`;
    })
    .join('');
  return (
    tournamentHeader(tournament, `${standings.length} players · ${tournament.rounds.length} rounds`) +
    youvePlayed +
    '<div class="section-label">Final standings</div>' +
    renderStandingsTable(standings) +
    '<div class="section-label">Round by round</div>' +
    rounds
  );
}
