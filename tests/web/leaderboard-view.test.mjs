import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLeaderboard, renderBreakdown, sortLeaderboard } from '../../web/ui/leaderboard-view.js';

test('renders ranked rows with names, initials, and preserves order', () => {
  const html = renderLeaderboard([
    { name: 'Ann Lee', points: 9, events: 3 },
    { name: 'Bob', points: 3, events: 1 },
  ]);
  assert.match(html, /Ann Lee/);
  assert.match(html, /AL/);
  assert.match(html, />1</);
  assert.ok(html.indexOf('Ann Lee') < html.indexOf('Bob'));
});

test('shows an empty state when there are no rows', () => {
  assert.match(renderLeaderboard([]), /No results/);
});

test('renderLeaderboard adds one breakdown button per row', () => {
  const html = renderLeaderboard([
    { name: 'Ann Lee', points: 9, events: 1, breakdown: [] },
    { name: 'Bob', points: 3, events: 1, breakdown: [] },
  ]);
  assert.equal((html.match(/class="why"/g) || []).length, 2);
  assert.match(html, /data-index="0"/);
  assert.match(html, /data-index="1"/);
});

test('shows a Points/Events column formatted to one decimal', () => {
  const html = renderLeaderboard([
    { name: 'Ann', points: 9, events: 2, breakdown: [] },
    { name: 'Bob', points: 3, events: 3, breakdown: [] },
  ]);
  assert.match(html, /Pts\/Event/);
  assert.match(html, />4\.5</); // 9 / 2
  assert.match(html, />1\.0</); // 3 / 3
});

test('renders sortable headers for events, points and pts/event', () => {
  const html = renderLeaderboard([{ name: 'Ann', points: 9, events: 2, breakdown: [] }]);
  assert.match(html, /data-sort="events"/);
  assert.match(html, /data-sort="points"/);
  assert.match(html, /data-sort="ppe"/);
});

test('marks points as the active descending sort by default', () => {
  const html = renderLeaderboard([{ name: 'Ann', points: 9, events: 2, breakdown: [] }]);
  assert.match(html, /data-sort="points"[^>]*aria-sort="descending"/);
  assert.match(html, /data-sort="events"[^>]*aria-sort="none"/);
});

test('reflects the given sort state on the header', () => {
  const html = renderLeaderboard(
    [{ name: 'Ann', points: 9, events: 2, breakdown: [] }],
    { col: 'ppe', dir: 'asc' },
  );
  assert.match(html, /data-sort="ppe"[^>]*aria-sort="ascending"/);
  assert.match(html, /data-sort="points"[^>]*aria-sort="none"/);
});

test('sortLeaderboard orders by a column and direction, name as tiebreak', () => {
  const rows = [
    { name: 'Ann', points: 9, events: 3 }, // ppe 3.0
    { name: 'Bob', points: 8, events: 2 }, // ppe 4.0
    { name: 'Cy', points: 8, events: 4 },  // ppe 2.0
  ];
  const byPpeDesc = sortLeaderboard(rows, { col: 'ppe', dir: 'desc' }).map(r => r.name);
  assert.deepEqual(byPpeDesc, ['Bob', 'Ann', 'Cy']);
  const byEventsAsc = sortLeaderboard(rows, { col: 'events', dir: 'asc' }).map(r => r.name);
  assert.deepEqual(byEventsAsc, ['Bob', 'Ann', 'Cy']);
  const byPointsDesc = sortLeaderboard(rows, { col: 'points', dir: 'desc' }).map(r => r.name);
  assert.deepEqual(byPointsDesc, ['Ann', 'Bob', 'Cy']); // Bob before Cy by name
});

test('sortLeaderboard does not mutate the input array', () => {
  const rows = [{ name: 'Ann', points: 3, events: 3 }, { name: 'Bob', points: 9, events: 3 }];
  sortLeaderboard(rows, { col: 'points', dir: 'desc' });
  assert.equal(rows[0].name, 'Ann');
});

test('renderBreakdown lists tournaments, items, subtotals and total', () => {
  const row = { name: 'Ann', points: 9, events: 1, breakdown: [
    { tournament: 'Showdown', date: '2026-07-10', items: [
      { label: '1st place', points: 3 },
      { label: '2 wins (×2)', points: 4 },
      { label: 'attendance', points: 1 },
    ], subtotal: 8 },
    { tournament: 'Store', date: '2026-08-01', items: [{ label: 'attendance', points: 1 }], subtotal: 1 },
  ] };
  const html = renderBreakdown(row);
  assert.match(html, /Ann — 9 pts/);
  assert.match(html, /Showdown · 2026-07-10/);
  assert.match(html, /1st place/);
  assert.match(html, /\+4/);
  assert.match(html, /Store · 2026-08-01/);
  assert.match(html, /Total/);
});
