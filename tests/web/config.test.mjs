import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../web/config.js';

test('config exposes a Supabase project URL', () => {
  assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
});

test('config exposes a non-trivial anon key', () => {
  assert.equal(typeof SUPABASE_ANON_KEY, 'string');
  assert.ok(SUPABASE_ANON_KEY.length > 20, 'anon key looks too short');
});
