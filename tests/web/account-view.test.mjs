import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAccount } from '../../web/ui/account-view.js';

test('signed out prompts to sign in', () => {
  const html = renderAccount(null, null);
  assert.ok(html.includes('Sign in to view your account'));
  assert.ok(html.includes('id="signin-btn"'));
});

test('linked account shows name, email, player link and sign out', () => {
  const html = renderAccount(
    { name: 'Ann Lee', email: 'ann@x.io', avatarUrl: 'https://x/y.png' }, 'Ann L');
  assert.ok(html.includes('Ann Lee'));
  assert.ok(html.includes('ann@x.io'));
  assert.ok(html.includes('href="#player/Ann%20L"'));
  assert.ok(html.includes('id="signout-btn"'));
});

test('unlinked account tells the user to ask an admin', () => {
  const html = renderAccount({ name: 'Ann Lee', email: 'ann@x.io', avatarUrl: null }, null);
  assert.ok(html.includes('Not linked yet'));
  assert.ok(html.includes('id="signout-btn"'));
  assert.ok(html.includes('>AL<'));
});
