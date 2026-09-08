import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerProfile } from '../../web/lib/player-stats.js';

const rec = (w, d, l) => ({ wins: w, draws: d, losses: l });

// Two round-based tournaments where Ann faces Bob and Cara.
const t1 = { id: 't1', name: 'One', date: '2026-07-06', rounds: [
  { round: 1, pairings: [
    { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: rec(1, 0, 0), deck: 'Azorius', deck_colours: 'WU' },
      player2: { name: 'Bob', game_wins: 0, record: rec(0, 0, 1) } },
    { pairing: 2, player1: { name: 'Cara', game_wins: 2, record: rec(1, 0, 0) }, player2: null },
  ] },
  { round: 2, pairings: [
    { pairing: 1, player1: { name: 'Ann', game_wins: 1, record: rec(1, 0, 1), deck: 'Azorius', deck_colours: 'WU' },
      player2: { name: 'Cara', game_wins: 2, record: rec(2, 0, 0) } },
    { pairing: 2, player1: { name: 'Bob', game_wins: 2, record: rec(1, 0, 1) }, player2: null },
  ] },
] };
const t2 = { id: 't2', name: 'Two', date: '2026-08-01', rounds: [
  { round: 1, pairings: [
    { pairing: 1, player1: { name: 'Ann', game_wins: 0, record: rec(0, 0, 1), deck: 'Mono Red', deck_colours: 'R' },
      player2: { name: 'Bob', game_wins: 2, record: rec(1, 0, 0) } },
  ] },
] };

test('counts 1st/2nd/3rd placements across tournaments', () => {
  const p = playerProfile([t1, t2], 'Cara');
  // t1: Cara 2-0-0 (1st). t2: Cara absent. Ann: t1 1-0-1 (mp3) vs Cara 2-0-0(mp6) vs Bob 1-0-1(mp3)
  assert.equal(p.placements.first, 1); // Cara won t1
  assert.equal(p.placements.second, 0);
  assert.equal(p.placements.third, 0);
});

test('placement for a non-winner', () => {
  const p = playerProfile([t1], 'Ann');
  // t1 order by mp then game wins: Cara(6) 1st, Ann(3, gw3) vs Bob(3, gw2) -> Ann 2nd, Bob 3rd
  assert.equal(p.placements.first, 0);
  assert.equal(p.placements.second, 1);
});

test('groups decks by tournament count', () => {
  const p = playerProfile([t1, t2], 'Ann');
  // Azorius across t1 (one tournament), Mono Red in t2
  assert.deepEqual(p.decks, [
    { deck: 'Azorius', tournaments: 1 },
    { deck: 'Mono Red', tournaments: 1 },
  ]);
});

test('rivals are opponents lost to the most', () => {
  const p = playerProfile([t1, t2], 'Ann');
  // Ann lost to Cara (t1 r2) once and to Bob (t2) once.
  const byName = Object.fromEntries(p.rivals.map(r => [r.name, r.losses]));
  assert.equal(byName['Cara'], 1);
  assert.equal(byName['Bob'], 1);
});

test('friends are opponents played the most, top 3', () => {
  const p = playerProfile([t1, t2], 'Ann');
  // Ann played Bob twice (t1 r1, t2 r1) and Cara once (t1 r2).
  assert.equal(p.friends[0].name, 'Bob');
  assert.equal(p.friends[0].games, 2);
  assert.ok(p.friends.find(f => f.name === 'Cara' && f.games === 1));
  assert.ok(p.friends.length <= 3);
});

test('summary: tournaments attended and final record', () => {
  const p = playerProfile([t1, t2], 'Ann');
  assert.equal(p.tournaments, 2);
  // final records: t1 -> 1-0-1, t2 -> 0-0-1 => 1-0-2
  assert.deepEqual(p.record, rec(1, 0, 2));
});

test('empty head-to-head when only standings-only events', () => {
  const legacy = { id: 'l', name: 'Legacy', date: '2026-07-20', rounds: [
    { round: 1, pairings: [
      { pairing: 1, player1: { name: 'Elliot', game_wins: null, record: rec(3, 0, 0) }, player2: null },
      { pairing: 2, player1: { name: 'Toms', game_wins: null, record: rec(2, 0, 1) }, player2: null },
    ] },
  ] };
  const p = playerProfile([legacy], 'Elliot');
  assert.equal(p.placements.first, 1);       // pairing-as-rank: Elliot 1st
  assert.deepEqual(p.rivals, []);
  assert.deepEqual(p.friends, []);
});

test('unknown player returns zeroed profile', () => {
  const p = playerProfile([t1], 'Nobody');
  assert.equal(p.tournaments, 0);
  assert.deepEqual(p.placements, { first: 0, second: 0, third: 0 });
  assert.deepEqual(p.decks, []);
});
