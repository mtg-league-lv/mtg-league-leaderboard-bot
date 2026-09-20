import { test } from 'node:test';
import assert from 'node:assert/strict';
import { associatedName } from '../../web/lib/association.js';

const players = [
  { player_key: 'ann', display_name: 'Ann' },
  { player_key: 'bob', display_name: 'Bob' },
];

test('returns the display name for a linked profile', () => {
  assert.equal(associatedName({ player_key: 'bob' }, players), 'Bob');
});

test('returns null when profile is null (anonymous)', () => {
  assert.equal(associatedName(null, players), null);
});

test('returns null when the profile has no player_key (unlinked)', () => {
  assert.equal(associatedName({ player_key: null }, players), null);
});

test('returns null when the key matches no known player', () => {
  assert.equal(associatedName({ player_key: 'zed' }, players), null);
});
