import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTournament } from '../../web/ui/tournament-view.js';

const rec = (w, d, l) => ({ wins: w, draws: d, losses: l });

test('marks the game-score winner and shows round labels and records', () => {
  const tournament = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0) }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(tournament);
  assert.match(html, /Round 1/);
  assert.match(html, /1-0-0/);
  assert.match(html, /2-1/);
  const markIndex = html.indexOf('✓');
  const scoreIndex = html.indexOf('2-1');
  assert.ok(markIndex > -1 && markIndex < scoreIndex);
});

test('renders a bye as a single-player row within a pairing event', () => {
  const tournament = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0) }, player2: { name: 'Bob', game_wins: 0, record: rec(0, 0, 1) } },
      { pairing: 2, player1: { name: 'Cara', game_wins: 2, record: rec(1, 0, 0) }, player2: null },
    ] },
  ] };
  const html = renderTournament(tournament);
  assert.match(html, /Bye/);
  assert.match(html, /Cara/);
});

test('marks player 2 as winner when they have more game wins', () => {
  const tournament = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 1, record: rec(0, 0, 1) }, player2: { name: 'Bob', game_wins: 2, record: rec(1, 0, 0) } },
    ] },
  ] };
  const html = renderTournament(tournament);
  const markIndex = html.indexOf('✓');
  const scoreIndex = html.indexOf('1-2');
  assert.ok(markIndex > scoreIndex);
});

test('marks neither side on a drawn game score', () => {
  const tournament = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 1, record: rec(0, 1, 0) }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 1, 0) } },
    ] },
  ] };
  const html = renderTournament(tournament);
  assert.ok(!html.includes('✓'));
  assert.ok(!html.includes('class="side win"'));
  assert.ok(!html.includes('class="side right win"'));
});

test('renders a standings-only event as a ranked table, not byes', () => {
  const legacy = { name: 'Monday Standard', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Elliot N', game_wins: null, record: rec(3, 0, 0) }, player2: null },
      { pairing: 3, player1: { name: 'Vlad K', game_wins: null, record: rec(2, 0, 1) }, player2: null },
      { pairing: 2, player1: { name: 'Toms L', game_wins: null, record: rec(3, 0, 0) }, player2: null },
    ] },
  ] };
  const html = renderTournament(legacy);
  assert.ok(!html.includes('Bye'));
  assert.ok(!html.includes('Round 1'));
  assert.ok(!html.includes('class="pairing'));
  assert.match(html, /Player/);
  assert.match(html, /Points/);
  assert.ok(html.indexOf('Elliot N') < html.indexOf('Toms L'));
  assert.ok(html.indexOf('Toms L') < html.indexOf('Vlad K'));
  assert.match(html, /3-0-0/);
  assert.match(html, /2-0-1/);
  assert.match(html, />9</);  // Elliot: 3*3+0
  assert.match(html, />6</);  // Vlad: 3*2+0
});

test('standings table is wrapped in a .standings container with its own grid', () => {
  const legacy = { name: 'Monday Standard', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Elliot N', game_wins: null, record: rec(3, 0, 0) }, player2: null },
    ] },
  ] };
  const html = renderTournament(legacy);
  assert.match(html, /class="standings"/);
});

test('standings wraps the player name in a truncatable element', () => {
  const legacy = { name: 'Monday Standard', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Vladislavs K', game_wins: null, record: rec(3, 0, 0) }, player2: null },
    ] },
  ] };
  const html = renderTournament(legacy);
  assert.match(html, /class="pname">Vladislavs K<\/span>/);
});

test('deck info is wrapped in a single .deck-info group (pips + name)', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1,
        player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), deck_colours: 'WU', deck: 'Azorius Control' },
        player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.match(html, /class="deck-info">/);
  // the mana pips and the deck name live inside the group
  assert.match(html, /class="deck-info">[\s\S]*mana-colours[\s\S]*deck-name[\s\S]*<\/span>/);
});

test('a normal pairing event still renders pairings (regression)', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0) }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.match(html, /Round 1/);
  assert.match(html, /2-1/);
  assert.match(html, /class="pairing/);
});

test('renders mana icons for deck colours in order, then the deck name', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1,
        player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), deck_colours: 'WUR', deck: 'Jeskai Control' },
        player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.ok(html.indexOf('icons/mana/W.svg') < html.indexOf('icons/mana/U.svg'));
  assert.ok(html.indexOf('icons/mana/U.svg') < html.indexOf('icons/mana/R.svg'));
  // A pairing event now renders the deck in both the final-standings table and
  // the round-by-round view, so each appears twice.
  assert.equal((html.match(/class="mana"/g) || []).length, 6);
  assert.match(html, /Jeskai Control/);
  assert.ok(html.indexOf('icons/mana/R.svg') < html.indexOf('Jeskai Control'));
  // Icons are wrapped in a single element so the flex gap doesn't space them apart.
  assert.equal((html.match(/class="mana-colours"/g) || []).length, 2);
});

test('shows no deck info when deck and colours are empty', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0) }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.ok(!html.includes('class="mana"'));
  assert.ok(!html.includes('deck-name'));
});

test('skips invalid colour characters (case-insensitive)', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), deck_colours: 'WxG' }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.equal((html.match(/class="mana"/g) || []).length, 4); // standings + rounds
  assert.match(html, /icons\/mana\/W\.svg/);
  assert.match(html, /icons\/mana\/G\.svg/);
});

test('shows deck info in the standings-table view too', () => {
  const legacy = { name: 'Legacy', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Elliot N', game_wins: null, record: rec(3, 0, 0), deck_colours: 'B', deck: 'Mono Black' }, player2: null },
    ] },
  ] };
  const html = renderTournament(legacy);
  assert.match(html, /icons\/mana\/B\.svg/);
  assert.match(html, /Mono Black/);
});
test('shows one "Not from League" pill for a non-league player in pairings', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1,
        player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), is_league: true },
        player2: { name: 'Guest', game_wins: 1, record: rec(0, 0, 1), is_league: false } },
    ] },
  ] };
  const html = renderTournament(t);
  assert.match(html, /Not from League/);
  // Shown in both the standings table and the round-by-round pairing.
  assert.equal((html.match(/Not from League/g) || []).length, 2);
});

test('no pill for league players or a missing is_league flag', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1,
        player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), is_league: true },
        player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1) } },
    ] },
  ] };
  assert.ok(!renderTournament(t).includes('Not from League'));
});

test('shows the pill on the bye player when non-league', () => {
  const t = { name: 'A', date: '2026-07-06', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), is_league: true }, player2: { name: 'Bob', game_wins: 1, record: rec(0, 0, 1), is_league: true } },
      { pairing: 2, player1: { name: 'Guest', game_wins: 2, record: rec(1, 0, 0), is_league: false }, player2: null },
    ] },
  ] };
  const html = renderTournament(t);
  // Standings table + the bye row in the round-by-round view.
  assert.equal((html.match(/Not from League/g) || []).length, 2);
});

test('shows the pill in the standings-table view too', () => {
  const legacy = { name: 'Legacy', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Elliot N', game_wins: null, record: rec(3, 0, 0), is_league: true }, player2: null },
      { pairing: 2, player1: { name: 'Guest', game_wins: null, record: rec(2, 0, 1), is_league: false }, player2: null },
    ] },
  ] };
  const html = renderTournament(legacy);
  assert.match(html, /Not from League/);
  assert.equal((html.match(/Not from League/g) || []).length, 1);
});

test('a round-based event shows final standings on top, then the rounds', () => {
  const t = { name: 'Monday', date: '2026-09-07', rounds: [
    { round: 1, pairings: [
      { pairing: 1,
        player1: { name: 'Sergey', game_wins: 2, record: rec(1, 0, 0), standing: 1 },
        player2: { name: 'Raitis', game_wins: 5, record: rec(1, 0, 0), standing: 2 } },
    ] },
    { round: 2, pairings: [
      { pairing: 1,
        player1: { name: 'Sergey', game_wins: 2, record: rec(2, 0, 0), standing: 1 },
        player2: { name: 'Raitis', game_wins: 0, record: rec(1, 0, 1), standing: 2 } },
    ] },
  ] };
  const html = renderTournament(t);
  // Both sections present, standings before the rounds.
  assert.match(html, /Final standings/);
  assert.match(html, /Round 1/);
  assert.ok(html.indexOf('Final standings') < html.indexOf('Round 1'));
  assert.ok(html.indexOf('class="standings"') < html.indexOf('class="round-label"'));
  // Standings order honours the official `standing` (Sergey 1st despite fewer game wins).
  const s = html.indexOf('class="standings"');
  const seg = html.slice(s, html.indexOf('class="round-label"'));
  assert.ok(seg.indexOf('Sergey') < seg.indexOf('Raitis'));
  // Final record used in the standings (Sergey 2-0-0 after round 2).
  assert.match(seg, /2-0-0/);
});
