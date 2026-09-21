import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeColours, isWithinDays, titleCase } from '../../web/lib/deck.js';

test('normalizeColours canonicalizes to WUBRG order and de-dupes', () => {
  assert.equal(normalizeColours('rw'), 'WR');
  assert.equal(normalizeColours('gubrw'), 'WUBRG');
  assert.equal(normalizeColours(['U', 'u', 'R']), 'UR');
});

test('normalizeColours strips invalid letters and is case-insensitive', () => {
  assert.equal(normalizeColours('Ux!zR'), 'UR');
  assert.equal(normalizeColours(''), '');
  assert.equal(normalizeColours(null), '');
});

test('isWithinDays is true before the deadline and false on/after it', () => {
  const evt = '2026-09-14';
  assert.equal(isWithinDays(evt, new Date('2026-09-20T23:00:00Z'), 7), true);  // day 6
  assert.equal(isWithinDays(evt, new Date('2026-09-21T00:00:00Z'), 7), false); // day 7
  assert.equal(isWithinDays(evt, new Date('2026-09-14T12:00:00Z'), 7), true);  // same day
});

test('titleCase capitalizes the first letter of every word', () => {
  assert.equal(titleCase('mono blue flash'), 'Mono Blue Flash');
  assert.equal(titleCase('izzet prowess'), 'Izzet Prowess');
  assert.equal(titleCase('5c resonating loot'), '5c Resonating Loot');
  assert.equal(titleCase('Golgari Life Gain'), 'Golgari Life Gain');
  assert.equal(titleCase(''), '');
  assert.equal(titleCase(null), '');
});
