import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, seasonKey, seasonLabel, tournamentsForSeason } from '../../web/lib/season.js';

test('seasonOf maps months to meteorological seasons', () => {
  assert.deepEqual(seasonOf('2026-01-15'), { year: 2026, season: 'winter', index: 0 });
  assert.deepEqual(seasonOf('2026-02-28'), { year: 2026, season: 'winter', index: 0 });
  assert.deepEqual(seasonOf('2026-03-01'), { year: 2026, season: 'spring', index: 1 });
  assert.deepEqual(seasonOf('2026-06-06'), { year: 2026, season: 'summer', index: 2 });
  assert.deepEqual(seasonOf('2026-07-20'), { year: 2026, season: 'summer', index: 2 });
  assert.deepEqual(seasonOf('2026-09-10'), { year: 2026, season: 'autumn', index: 3 });
  assert.deepEqual(seasonOf('2026-11-30'), { year: 2026, season: 'autumn', index: 3 });
});

test('December rolls into the following year winter', () => {
  assert.deepEqual(seasonOf('2025-12-05'), { year: 2026, season: 'winter', index: 0 });
});

test('seasonKey is chronologically sortable', () => {
  assert.equal(seasonKey('2026-07-20'), '2026-2');
  assert.equal(seasonKey('2025-12-05'), '2026-0');
  const keys = ['2026-2', '2025-3', '2026-0'].sort();
  assert.deepEqual(keys, ['2025-3', '2026-0', '2026-2']);
});

test('seasonLabel formats season and year', () => {
  assert.equal(seasonLabel('2026-07-20'), 'Summer 2026');
  assert.equal(seasonLabel('2025-12-05'), 'Winter 2026');
  assert.equal(seasonLabel('2026-04-01'), 'Spring 2026');
});

test('tournamentsForSeason returns only that season, newest first', () => {
  const ts = [
    { id: 'a', date: '2026-07-06' }, // Summer 2026
    { id: 'b', date: '2026-08-31' }, // Summer 2026
    { id: 'c', date: '2026-04-12' }, // Spring 2026
    { id: 'd', date: '2026-08-10' }, // Summer 2026
  ];
  const summer = tournamentsForSeason(ts, '2026-2');
  assert.deepEqual(summer.map(t => t.id), ['b', 'd', 'a']); // desc by date
  assert.deepEqual(tournamentsForSeason(ts, '2026-1').map(t => t.id), ['c']);
  assert.deepEqual(tournamentsForSeason(ts, '2025-0'), []);
});

test('tournamentsForSeason does not mutate the input', () => {
  const ts = [{ id: 'a', date: '2026-07-06' }, { id: 'b', date: '2026-08-31' }];
  tournamentsForSeason(ts, '2026-2');
  assert.deepEqual(ts.map(t => t.id), ['a', 'b']);
});
