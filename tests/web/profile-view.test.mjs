import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProfile } from '../../web/ui/profile-view.js';
import { playerLink } from '../../web/ui/player-link.js';

test('playerLink encodes the name in the href and shows it as text', () => {
  const html = playerLink('Sergey P');
  assert.match(html, /href="#player\/Sergey%20P"/);
  assert.match(html, />Sergey P<\/a>/);
  assert.match(html, /class="player-link"/);
});

test('playerLink adds an extra class when given', () => {
  assert.match(playerLink('Ann', 'pname'), /class="player-link pname"/);
});

const profile = {
  tournaments: 3,
  record: { wins: 6, draws: 1, losses: 2 },
  placements: { first: 2, second: 1, third: 0 },
  decks: [{ deck: 'Azorius Flash', colours: 'WU', tournaments: 2 }, { deck: 'Mono Red', colours: 'R', tournaments: 1 }],
  rivals: [{ name: 'Bob', losses: 3 }, { name: 'Cara', losses: 1 }],
  friends: [{ name: 'Bob', games: 5 }, { name: 'Dan', games: 2 }],
};

test('renders header, placements, decks, rivals and friends', () => {
  const html = renderProfile('Ann', profile);
  assert.match(html, /Ann/);
  assert.match(html, /3 tournaments/);
  assert.match(html, /6.1.2/); // 6-1-2 record
  assert.match(html, /Azorius Flash/);
  assert.match(html, /2 tournaments/);
  // deck colours render as mana pips after the name (W then U)
  assert.ok(html.indexOf('icons/mana/W.svg') < html.indexOf('icons/mana/U.svg'));
  assert.ok(html.indexOf('Azorius Flash') < html.indexOf('icons/mana/W.svg'));
  assert.match(html, /Bob/);
  assert.match(html, /3 losses/);
  assert.match(html, /5 games/);
  // placement counts present
  assert.match(html, />2</);
  assert.match(html, />1</);
});

test('shows empty states for decks and head-to-head', () => {
  const html = renderProfile('New', {
    tournaments: 1, record: { wins: 0, draws: 0, losses: 3 },
    placements: { first: 0, second: 0, third: 0 }, decks: [], rivals: [], friends: [],
  });
  assert.match(html, /No decks recorded/);
  assert.match(html, /No head-to-head data/);
});

test('unknown player (no tournaments) shows a friendly message', () => {
  const html = renderProfile('Ghost', {
    tournaments: 0, record: { wins: 0, draws: 0, losses: 0 },
    placements: { first: 0, second: 0, third: 0 }, decks: [], rivals: [], friends: [],
  });
  assert.match(html, /No data for this player/);
});
