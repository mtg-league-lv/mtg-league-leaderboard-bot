import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAuthControl } from '../../web/ui/auth-control.js';

test('signed out shows a Sign in button', () => {
  const html = renderAuthControl(null);
  assert.ok(html.includes('id="signin-btn"'));
  assert.ok(html.includes('Sign in'));
});

test('signed in with a picture shows an avatar image linking to #account', () => {
  const html = renderAuthControl({ name: 'Ann Lee', avatarUrl: 'https://x/y.png' });
  assert.ok(html.includes('href="#account"'));
  assert.ok(html.includes('src="https://x/y.png"'));
});

test('signed in without a picture falls back to initials', () => {
  const html = renderAuthControl({ name: 'Ann Lee', avatarUrl: null });
  assert.ok(html.includes('href="#account"'));
  assert.ok(html.includes('>AL<'));
});
