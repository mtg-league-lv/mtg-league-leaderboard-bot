import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAccount } from '../../web/ui/account-view.js';

const sampleProfile = {
  tournaments: 3,
  record: { wins: 5, draws: 0, losses: 2 },
  placements: { first: 1, second: 0, third: 1 },
  colours: { top: ['U', 'R'], pct: 60 },
  decks: [{ deck: 'Izzet', colours: 'UR', tournaments: 2 }],
  rivals: [{ name: 'Bob', losses: 1 }],
  friends: [{ name: 'Cara', games: 2 }],
};

test('signed out prompts to sign in with both providers', () => {
  const html = renderAccount(null, null);
  assert.ok(html.includes('Sign in to view your account'));
  assert.ok(html.includes('data-provider="discord"'));
  assert.ok(html.includes('data-provider="google"'));
  assert.ok(html.includes('Sign in with Discord'));
});

test('linked account embeds the player profile (not a link)', () => {
  const html = renderAccount(
    { name: 'Ann Lee', email: 'ann@x.io', avatarUrl: 'https://x/y.png' },
    { name: 'Ann L', profile: sampleProfile, seasons: [], selectedSeason: 'all' },
  );
  assert.ok(html.includes('Ann Lee'));           // account identity
  assert.ok(html.includes('ann@x.io'));
  assert.ok(html.includes('id="signout-btn"'));
  // Embedded profile content is present…
  assert.ok(html.includes('Placements'));
  assert.ok(html.includes('Izzet'));
  assert.ok(html.includes('>Ann L<'));           // player-name heading
  // …and the linked player is embedded, not a link to their own standalone page.
  assert.ok(!html.includes('href="#player/Ann%20L"'));
  // Exactly one back link (the account's own; the embed omits its back link).
  assert.equal(html.split('class="back-link"').length - 1, 1);
});

test('unlinked account tells the user to ask an admin', () => {
  const html = renderAccount({ name: 'Ann Lee', email: 'ann@x.io', avatarUrl: null }, null);
  assert.ok(html.includes('Not linked yet'));
  assert.ok(html.includes('id="signout-btn"'));
  assert.ok(html.includes('>AL<'));
});
