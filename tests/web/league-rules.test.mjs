import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLeagueRules } from '../../web/ui/league-rules.js';

test('renders the major rules sections', () => {
  const html = renderLeagueRules();
  for (const heading of [
    'Getting Started',
    'Building Your Collection',
    'Deckbuilding Rules',
    'League Credit',
    'Earning League Credit',
    'Spending League Credit',
    'Upgrading Your Collection',
    'Trading Rules',
    'Banning Cards for Winners',
    'Store Championships',
    'MTG League Rank System',
  ]) {
    assert.ok(html.includes(heading), `missing section: ${heading}`);
  }
});

test('lists all eight ranks as rank cards', () => {
  const html = renderLeagueRules();
  for (const rank of [
    'Uninitiated', 'Sparkbearer', 'Planeswalker', 'Archmage',
    'Paragon', 'Mythic Ascendant', 'Living Legend', 'Forgotten Gods',
  ]) {
    assert.ok(html.includes(rank), `missing rank: ${rank}`);
  }
  assert.equal((html.match(/class="lr-rank"/g) || []).length, 8);
});

test('explains the eloScore rating system with its formula and examples', () => {
  const html = renderLeagueRules();
  for (const text of [
    'League Rating (eloScore)', 'starts at <strong>500</strong>', 'Difficulty Multiplier',
    'min(2.0, max(1.0', '+25 × multiplier', '+96', '+125', '717',
  ]) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
});
