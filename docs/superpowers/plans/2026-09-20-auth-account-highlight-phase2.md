# Auth + Account + Highlight (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors sign in with Google, see an **Account** page via a top-right avatar, and — when an admin has linked their account to a player in the `profiles` table — highlight **their** player's row on the Leaderboard with a light-blue background. All existing pages stay fully public and unchanged for anonymous visitors.

**Architecture:** Builds on Phase 1's live reads. Pure, unit-tested modules do the rendering and mapping (`association.js`, `auth-control.js`, `account-view.js`, a new `renderLeaderboard` highlight arg). A thin browser-only `auth.js` wraps `supabase.auth`. `app.js` holds one shared Supabase client, resolves the viewer on load and on auth-state changes, and drives the topbar avatar, the `#account` route, and the highlight. A `profiles` table (`id → auth.users`, `player_key → players`) with own-row-only RLS backs the association; the admin sets the link manually in the dashboard.

**Tech Stack:** Vanilla ES modules, `@supabase/supabase-js` v2 (CDN ESM) Auth + PostgREST, Google OAuth, Node's built-in test runner (`node --test tests/web/*.test.mjs`), Supabase Postgres + RLS.

---

## Background facts (verified)

- Phase 1 is merged to `main`: `web/config.js`, `web/lib/site-data.js`, `web/lib/supabase-data.js`, live `boot()` in `app.js`, and public-read RLS on `tournaments`/`round_results`/`players`.
- All `public` tables have RLS enabled. There is already an unrelated `users` table (locked, no policies) — **do not touch it**; we add a new `profiles` table, no collision.
- Supabase project `shtatdxrwmiyzzvrfaai`, URL `https://shtatdxrwmiyzzvrfaai.supabase.co`.
- `web/styles.css` already defines theme tokens incl. `--accent-bg` (light blue `#e6f1fb` in light mode, a blue in dark) and `.avatar` (initials chip). `.topbar` is `display:flex; justify-content:space-between`. Leaderboard rows are `.row` (CSS grid).
- `renderLeaderboard(rows, sort, moves)` builds each row as `<div class="row">…`; row identity is `row.name`. Leaderboard row names come from `round_results.player_name`; `players.display_name` was populated from the same source, so display names match.
- Node cannot import `https://` URLs, so **no test-imported module may import the CDN**. Keep the CDN + `supabase.auth` calls inside `app.js`/`auth.js`; keep `auth.js` out of every test's import graph.
- Existing tests: `node --test tests/web/*.test.mjs` (96) and `pytest` (66) both green.

## File Structure

- Create `web/lib/association.js` — pure `associatedName(profile, players)`.
- Create `web/ui/auth-control.js` — pure `renderAuthControl(user)` (topbar avatar / Sign in).
- Create `web/ui/account-view.js` — pure `renderAccount(user, playerName)` (Account page).
- Create `web/lib/auth.js` — thin `supabase.auth` wrapper (no unit tests; browser-verified).
- Modify `web/lib/supabase-data.js` — fetch `display_name`; `loadSiteData` returns `{ tournaments, players }`.
- Modify `web/ui/leaderboard-view.js` — `renderLeaderboard(..., highlightName)` adds `me` class.
- Modify `web/index.html` — topbar auth-control container + `#view-account` section.
- Modify `web/app.js` — shared client, viewer resolution, auth-state wiring, `#account` route, highlight.
- Modify `web/styles.css` — `.row.me`, auth control, account page.
- Modify `supabase/schema.sql` + apply a `profiles` migration to the live DB.
- Create `docs/deploy/phase2-auth-setup.md` — the one-time admin/Google setup checklist.
- Tests: `tests/web/association.test.mjs`, `tests/web/auth-control.test.mjs`, `tests/web/account-view.test.mjs`; append to `tests/web/supabase-data.test.mjs` and `tests/web/leaderboard-view.test.mjs`.

---

### Task 1: Expose players (with display_name) from the loader

**Files:**
- Modify: `web/lib/supabase-data.js`
- Test: `tests/web/supabase-data.test.mjs` (append)

The highlight needs to map a linked `player_key` → display name. Fetch `display_name` and return the raw players list alongside the built tournaments. The existing `(await loadSiteData(client)).tournaments` callers keep working.

- [ ] **Step 1: Write the failing test (append to `tests/web/supabase-data.test.mjs`)**

```js
test('loadSiteData returns raw players including display_name', async () => {
  const client = new FakeClient({
    tournaments: [{ id: 1, name: 'A', event_date: '2026-07-06' }],
    round_results: [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0)],
    players: [{ player_key: 'ann', display_name: 'Ann', is_league: true }],
  });
  const data = await loadSiteData(client);
  assert.deepEqual(data.players, [{ player_key: 'ann', display_name: 'Ann', is_league: true }]);
  assert.equal(data.tournaments[0].rounds[0].pairings[0].player1.name, 'Ann');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/supabase-data.test.mjs`
Expected: FAIL — `data.players` is `undefined`.

- [ ] **Step 3: Update `web/lib/supabase-data.js`**

Change the players column list and the `loadSiteData` return. Replace:

```js
const PLAYER_COLS = 'player_key, is_league';
```

with:

```js
const PLAYER_COLS = 'player_key, display_name, is_league';
```

Replace the `loadSiteData` body's final lines:

```js
  const leagueKeys = new Set(
    players.filter(p => p.is_league).map(p => p.player_key),
  );
  return buildSiteData(tournaments, results, leagueKeys);
```

with:

```js
  const leagueKeys = new Set(
    players.filter(p => p.is_league).map(p => p.player_key),
  );
  return { ...buildSiteData(tournaments, results, leagueKeys), players };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/web/supabase-data.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/supabase-data.js tests/web/supabase-data.test.mjs
git commit -m "feat(web): expose players with display_name from loader"
```

---

### Task 2: Pure `associatedName`

**Files:**
- Create: `web/lib/association.js`
- Test: `tests/web/association.test.mjs`

Maps the viewer's linked `player_key` to the display name used as the Leaderboard row identity. Returns `null` for anonymous, unlinked, or unknown keys.

- [ ] **Step 1: Write the failing tests**

Create `tests/web/association.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/association.test.mjs`
Expected: FAIL — cannot find module `../../web/lib/association.js`.

- [ ] **Step 3: Write `web/lib/association.js`**

```js
// Map the signed-in viewer's linked player_key to the display name used as the
// Leaderboard row identity. Pure: no auth, no network. `profile` is the viewer's
// own profiles row ({ player_key } | null); `players` is the raw players list.
export function associatedName(profile, players) {
  if (!profile || !profile.player_key) return null;
  const match = players.find(p => p.player_key === profile.player_key);
  return match ? match.display_name : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/web/association.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/association.js tests/web/association.test.mjs
git commit -m "feat(web): pure associatedName mapping"
```

---

### Task 3: Leaderboard highlight

**Files:**
- Modify: `web/ui/leaderboard-view.js`
- Modify: `web/styles.css` (append)
- Test: `tests/web/leaderboard-view.test.mjs` (append)

Add an optional `highlightName` argument to `renderLeaderboard`; the matching row gets the `me` class. Default `null` → no highlight (anonymous view unchanged).

- [ ] **Step 1: Write the failing tests (append to `tests/web/leaderboard-view.test.mjs`)**

```js
test('renderLeaderboard highlights the viewer row with the me class', () => {
  const rows = [
    { name: 'Ann', events: 1, points: 3, breakdown: [] },
    { name: 'Bob', events: 1, points: 1, breakdown: [] },
  ];
  const html = renderLeaderboard(rows, { col: 'points', dir: 'desc' }, new Map(), 'Bob');
  assert.equal(html.split('class="row me"').length - 1, 1); // exactly one highlighted row
  assert.ok(html.includes('Bob'));
});

test('renderLeaderboard adds no highlight when highlightName is null', () => {
  const rows = [{ name: 'Ann', events: 1, points: 3, breakdown: [] }];
  const html = renderLeaderboard(rows, { col: 'points', dir: 'desc' }, new Map(), null);
  assert.ok(!html.includes('class="row me"'));
});
```

(If the file's existing tests don't already import `renderLeaderboard`, it is exported from `../../web/ui/leaderboard-view.js`; the file already imports it for other cases.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/leaderboard-view.test.mjs`
Expected: FAIL — no `class="row me"` (current signature ignores the 4th arg).

- [ ] **Step 3: Update `web/ui/leaderboard-view.js`**

Change the `renderLeaderboard` signature line:

```js
export function renderLeaderboard(rows, sort = { col: 'points', dir: 'desc' }, moves = new Map()) {
```

to:

```js
export function renderLeaderboard(rows, sort = { col: 'points', dir: 'desc' }, moves = new Map(), highlightName = null) {
```

Inside the `rows.map((row, index) => {` body, replace the opening row div. Change:

```js
      return (
        `<div class="row">` +
```

to:

```js
      const rowClass = row.name === highlightName ? 'row me' : 'row';
      return (
        `<div class="${rowClass}">` +
```

- [ ] **Step 4: Add the highlight style (append to `web/styles.css`)**

```css
/* The signed-in, admin-linked viewer's own leaderboard row. */
.row.me { background: var(--accent-bg); }
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/web/leaderboard-view.test.mjs`
Expected: PASS (existing cases + 2 new).

- [ ] **Step 6: Commit**

```bash
git add web/ui/leaderboard-view.js web/styles.css tests/web/leaderboard-view.test.mjs
git commit -m "feat(web): light-blue highlight for the viewer's leaderboard row"
```

---

### Task 4: Topbar auth control (pure render + markup + CSS)

**Files:**
- Create: `web/ui/auth-control.js`
- Test: `tests/web/auth-control.test.mjs`
- Modify: `web/index.html`
- Modify: `web/styles.css` (append)

- [ ] **Step 1: Write the failing tests**

Create `tests/web/auth-control.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/auth-control.test.mjs`
Expected: FAIL — cannot find module `../../web/ui/auth-control.js`.

- [ ] **Step 3: Write `web/ui/auth-control.js`**

```js
// Top-right topbar control: a "Sign in" button when signed out, or the Google
// avatar (photo, else initials) linking to the Account route when signed in.
// Pure HTML string; click wiring lives in app.js.
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function renderAuthControl(user) {
  if (!user) {
    return '<button id="signin-btn" class="auth-signin" type="button">Sign in</button>';
  }
  const inner = user.avatarUrl
    ? `<img class="auth-avatar-img" src="${user.avatarUrl}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="avatar">${initials(user.name)}</span>`;
  return `<a class="auth-avatar" href="#account" aria-label="Account" title="${user.name}">${inner}</a>`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/web/auth-control.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the topbar container + account section to `web/index.html`**

In the `<header class="topbar">`, wrap the nav and add an auth container. Replace:

```html
      <nav class="tabs">
        <button id="tab-lb" class="tab" aria-selected="true">Leaderboard</button>
        <button id="tab-td" class="tab" aria-selected="false">Tournament</button>
        <button id="tab-rules" class="tab" aria-selected="false">Rules</button>
      </nav>
```

with:

```html
      <div class="topbar-right">
        <nav class="tabs">
          <button id="tab-lb" class="tab" aria-selected="true">Leaderboard</button>
          <button id="tab-td" class="tab" aria-selected="false">Tournament</button>
          <button id="tab-rules" class="tab" aria-selected="false">Rules</button>
        </nav>
        <div id="auth-control" class="auth-control"></div>
      </div>
```

And add the account section next to the other views. Change:

```html
      <section id="view-profile" hidden></section>
```

to:

```html
      <section id="view-profile" hidden></section>
      <section id="view-account" hidden></section>
```

- [ ] **Step 6: Add auth-control styles (append to `web/styles.css`)**

```css
.topbar-right { display: flex; align-items: center; gap: 12px; }
.auth-control { display: flex; align-items: center; }
.auth-signin {
  padding: 7px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}
.auth-signin:hover { border-color: var(--muted); }
.auth-avatar { display: inline-flex; border-radius: 50%; }
.auth-avatar-img {
  width: 32px; height: 32px; border-radius: 50%;
  object-fit: cover; display: block;
}
```

- [ ] **Step 7: Commit**

```bash
git add web/ui/auth-control.js tests/web/auth-control.test.mjs web/index.html web/styles.css
git commit -m "feat(web): topbar auth control (Sign in / avatar)"
```

---

### Task 5: Account page (pure render + CSS)

**Files:**
- Create: `web/ui/account-view.js`
- Test: `tests/web/account-view.test.mjs`
- Modify: `web/styles.css` (append)

- [ ] **Step 1: Write the failing tests**

Create `tests/web/account-view.test.mjs`:

```js
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
  assert.ok(html.includes('>AL<')); // initials fallback avatar
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/account-view.test.mjs`
Expected: FAIL — cannot find module `../../web/ui/account-view.js`.

- [ ] **Step 3: Write `web/ui/account-view.js`**

```js
import { playerLink } from './player-link.js';

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Account page. `user` is { name, email, avatarUrl } or null (signed out);
// `playerName` is the linked player's display name or null. Pure HTML string;
// the sign-in / sign-out buttons are wired by delegation in app.js.
export function renderAccount(user, playerName) {
  const back = '<a class="back-link" href="#">← Back</a>';
  if (!user) {
    return back +
      '<div class="account">' +
      '<h1 class="profile-name">Your account</h1>' +
      '<p class="profile-empty">Sign in to view your account.</p>' +
      '<button id="signin-btn" class="auth-signin" type="button">Sign in with Google</button>' +
      '</div>';
  }
  const avatar = user.avatarUrl
    ? `<img class="account-avatar" src="${user.avatarUrl}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="avatar">${initials(user.name)}</span>`;
  const linked = playerName
    ? `<p class="account-linked">Linked to ${playerLink(playerName)}</p>`
    : '<p class="profile-empty">Not linked yet — ask an admin to link your account to a player.</p>';
  return back +
    '<div class="account">' +
    `<div class="account-head">${avatar}` +
    `<div><h1 class="profile-name">${user.name}</h1>` +
    `<div class="account-email">${user.email ?? ''}</div></div></div>` +
    linked +
    '<button id="signout-btn" class="auth-signin" type="button">Sign out</button>' +
    '</div>';
}
```

- [ ] **Step 4: Add account styles (append to `web/styles.css`)**

```css
.account { padding: 12px 0; display: flex; flex-direction: column; gap: 14px; }
.account-head { display: flex; align-items: center; gap: 14px; }
.account-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
.account-email { color: var(--muted); font-size: 14px; }
.account-linked { font-size: 15px; }
.account .auth-signin { align-self: flex-start; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/web/account-view.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add web/ui/account-view.js tests/web/account-view.test.mjs web/styles.css
git commit -m "feat(web): Account page renderer"
```

---

### Task 6: Auth wrapper (browser-only)

**Files:**
- Create: `web/lib/auth.js`

Thin delegation over `supabase.auth` and the viewer's own `profiles` row. No unit tests (I/O only; browser-verified in Task 9). Not imported by any test.

- [ ] **Step 1: Write `web/lib/auth.js`**

```js
// Thin browser-only wrapper over supabase.auth + the viewer's own profiles row.
// Pure rendering/mapping lives in association.js and the *-view.js modules.

function toUser(u) {
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: m.full_name || m.name || u.email || 'Player',
    avatarUrl: m.avatar_url || m.picture || null,
  };
}

export async function currentUser(client) {
  const { data } = await client.auth.getUser();
  return data.user ? toUser(data.user) : null;
}

export function onUserChange(client, cb) {
  return client.auth.onAuthStateChange((_event, session) => {
    cb(session && session.user ? toUser(session.user) : null);
  });
}

export function signInWithGoogle(client, redirectTo) {
  return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

export function signOut(client) {
  return client.auth.signOut();
}

export async function associatedPlayerKey(client) {
  // RLS returns only the caller's own row; null when unlinked or signed out.
  const { data, error } = await client.from('profiles').select('player_key').maybeSingle();
  if (error) return null;
  return data ? data.player_key : null;
}
```

- [ ] **Step 2: Sanity-check it parses (no test imports it)**

Run: `node --check web/lib/auth.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/lib/auth.js
git commit -m "feat(web): supabase auth wrapper"
```

---

### Task 7: `profiles` table + RLS

**Files:**
- Modify: `supabase/schema.sql` (append)
- Apply migration to the live DB via the `apply_migration` MCP tool (project `shtatdxrwmiyzzvrfaai`).

- [ ] **Step 1: Record the table + policy in `supabase/schema.sql` (append)**

```sql

-- Links a signed-in auth user to a league player. The admin sets player_key
-- manually in the Supabase dashboard (service_role bypasses RLS). Users may read
-- ONLY their own row; there are no user write policies.
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  player_key text references players(player_key),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select to authenticated using (auth.uid() = id);
```

- [ ] **Step 2: Apply to the live database**

Use the `apply_migration` MCP tool with `project_id: shtatdxrwmiyzzvrfaai`, `name: profiles_table`, and `query` = exactly the SQL from Step 1.

- [ ] **Step 3: Verify**

With `execute_sql` (`project_id: shtatdxrwmiyzzvrfaai`):

```sql
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public' and tablename = 'profiles';
```

Expected: one row — `own profile read`, `SELECT`, roles `{authenticated}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): profiles table with own-row RLS"
```

---

### Task 8: Wire `app.js` (client, viewer, account route, highlight)

**Files:**
- Modify: `web/app.js`

One shared client; resolve the viewer on load and on auth changes; render the topbar control; add the `#account` route; pass the highlight name to the leaderboard.

- [ ] **Step 1: Update imports**

In `web/app.js`, the Phase-1 import block currently reads:

```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { loadSiteData } from './lib/supabase-data.js';
```

Add below it:

```js
import { associatedName } from './lib/association.js';
import { renderAuthControl } from './ui/auth-control.js';
import { renderAccount } from './ui/account-view.js';
import { currentUser, onUserChange, signInWithGoogle, signOut, associatedPlayerKey } from './lib/auth.js';
```

- [ ] **Step 2: Extend state and add the shared client + viewer refresh**

Replace:

```js
const state = { tournaments: [] };

async function boot() {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.tournaments = (await loadSiteData(client)).tournaments;
  } catch {
    const message = '<div class="empty">Couldn\'t load data.</div>';
    document.getElementById('lb-body').innerHTML = message;
    document.getElementById('td-body').innerHTML = message;
    return;
  }
  setupTabs();
  setupLeaderboard();
  setupTournaments();
  setupRules();
  document.getElementById('rules-view').innerHTML = renderLeagueRules();
}
```

with:

```js
const state = {
  tournaments: [], players: [], user: null, associatedName: null,
  renderLeaderboard: null, showAccount: null,
};

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const redirectTo = () => location.origin + location.pathname;

async function refreshViewer() {
  state.user = await currentUser(client);
  const key = state.user ? await associatedPlayerKey(client) : null;
  state.associatedName = associatedName(key ? { player_key: key } : null, state.players);
  document.getElementById('auth-control').innerHTML = renderAuthControl(state.user);
}

async function boot() {
  try {
    const data = await loadSiteData(client);
    state.tournaments = data.tournaments;
    state.players = data.players;
  } catch {
    const message = '<div class="empty">Couldn\'t load data.</div>';
    document.getElementById('lb-body').innerHTML = message;
    document.getElementById('td-body').innerHTML = message;
    return;
  }

  // Sign-in click (the control is re-rendered, so delegate from the container).
  document.getElementById('auth-control').addEventListener('click', event => {
    if (event.target.closest('#signin-btn')) signInWithGoogle(client, redirectTo());
  });

  await refreshViewer();
  setupTabs();
  setupLeaderboard();
  setupTournaments();
  setupRules();
  document.getElementById('rules-view').innerHTML = renderLeagueRules();

  onUserChange(client, async () => {
    await refreshViewer();
    if (state.renderLeaderboard) state.renderLeaderboard();
    if (location.hash === '#account' && state.showAccount) state.showAccount();
  });
}
```

- [ ] **Step 3: Add the `#account` route inside `setupTabs`**

In `setupTabs`, after the `const profileView = document.getElementById('view-profile');` line, add:

```js
  const accountView = document.getElementById('view-account');
```

In `showActiveTab()`, hide the account view too — change:

```js
  function showActiveTab() {
    profileView.hidden = true;
```

to:

```js
  function showActiveTab() {
    profileView.hidden = true;
    accountView.hidden = true;
```

Add a `showAccount` function and expose it on `state` — insert after the `showProfile` function:

```js
  function showAccount() {
    for (const t of tabs) t.view.hidden = true;
    profileView.hidden = true;
    accountView.innerHTML = renderAccount(state.user, state.associatedName);
    accountView.hidden = false;
    window.scrollTo(0, 0);
  }
  state.showAccount = showAccount;
  accountView.addEventListener('click', event => {
    if (event.target.closest('#signin-btn')) signInWithGoogle(client, redirectTo());
    if (event.target.closest('#signout-btn')) signOut(client);
  });
```

Update `route()` to handle `#account` — change:

```js
  function route() {
    const match = location.hash.match(/^#player\/(.+)$/);
    if (match) showProfile(decodeURIComponent(match[1]));
    else showActiveTab();
  }
```

to:

```js
  function route() {
    const match = location.hash.match(/^#player\/(.+)$/);
    if (match) showProfile(decodeURIComponent(match[1]));
    else if (location.hash === '#account') showAccount();
    else showActiveTab();
  }
```

Also update the tab-button handler so leaving the account view clears the hash. Change:

```js
      if (location.hash.startsWith('#player/')) location.hash = '';
      else showActiveTab();
```

to:

```js
      if (location.hash.startsWith('#player/') || location.hash === '#account') location.hash = '';
      else showActiveTab();
```

- [ ] **Step 4: Pass the highlight to the leaderboard**

In `setupLeaderboard`, change the render body line:

```js
    body.innerHTML = renderLeaderboard(currentRows, sort, moves);
```

to:

```js
    body.innerHTML = renderLeaderboard(currentRows, sort, moves, state.associatedName);
```

At the end of `setupLeaderboard`, after `render();`, expose it for auth-change re-renders — change:

```js
  select.addEventListener('change', render);
  render();
}
```

to:

```js
  select.addEventListener('change', render);
  state.renderLeaderboard = render;
  render();
}
```

- [ ] **Step 5: Run the whole web suite**

Run: `node --test tests/web/*.test.mjs`
Expected: PASS — all suites (Phase 1 + Phase 2 units). `app.js` and `auth.js` are not imported by any test.

- [ ] **Step 6: Commit**

```bash
git add web/app.js
git commit -m "feat(web): sign-in, Account route, and viewer highlight wiring"
```

---

### Task 9: Manual setup + browser verification

**Files:**
- Create: `docs/deploy/phase2-auth-setup.md`

- [ ] **Step 1: Write the setup checklist**

Create `docs/deploy/phase2-auth-setup.md`:

```markdown
# Phase 2 auth — one-time setup

1. **Google Cloud** → create an OAuth 2.0 Client (Web application).
   - Authorized redirect URI: `https://shtatdxrwmiyzzvrfaai.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client secret.
2. **Supabase → Authentication → Providers → Google:** enable, paste the Client ID/secret, save.
3. **Supabase → Authentication → Providers:** ensure **Email** signups are disabled
   (Google-only), so the public anon key can't be used to self-register or spam auth emails.
4. **Supabase → Authentication → URL Configuration:**
   - Site URL: the GitHub Pages URL of the site.
   - Redirect URLs: add the same Pages URL.
5. **Apply the `profiles` migration** (done via apply_migration in Task 7).
6. **Link a user to a player:** after the person signs in once (creating their
   `auth.users` row), insert a `profiles` row in the dashboard:
   `id` = their auth user id (Authentication → Users), `player_key` = the player's key.
```

- [ ] **Step 2: Perform steps 1–4 in the dashboards** (Google Cloud + Supabase). These are console actions outside the repo.

- [ ] **Step 3: Serve `web/` and verify anonymous behaviour is unchanged**

Serve `web/` over http and open it. Signed out: Leaderboard/Tournament/Profile render as before; the topbar shows **Sign in**; no row highlight; visiting `#account` shows the "Sign in to view your account" prompt. Check the console for no errors.

- [ ] **Step 4: Verify the signed-in flow**

Click **Sign in** → Google → back to the site. Confirm: the topbar shows the Google avatar; clicking it opens the Account page with name/email; when unlinked it says "Not linked yet". Then insert the `profiles` link row (setup step 6), reload, and confirm the Account page links to the player and the Leaderboard highlights that player's row in light blue. Sign out → highlight and avatar clear.

- [ ] **Step 5: Commit the doc**

```bash
git add docs/deploy/phase2-auth-setup.md
git commit -m "docs: Phase 2 auth setup checklist"
```

---

## Self-Review

**1. Spec coverage (Phase 2 section of the design spec):**
- "shared `web/lib/auth.js` wraps supabase.auth (signInWithOAuth google, signOut, onAuthStateChange)" → Task 6.
- "Top-right avatar: signed out → Sign in; signed in → Google avatar → Account route; reactive" → Tasks 4 + 8 (`onUserChange`).
- "Account page (`#account`): name/email/avatar, associated player link or 'Not linked yet — ask an admin', Sign out; deep-link while logged out → sign-in prompt" → Tasks 5 + 8.
- "`profiles` table (id→auth.users, player_key→players, created_at); own-row select RLS; no user writes" → Task 7.
- "pure `associatedName(profile, players)`; light-blue background on the matching Leaderboard row only; anonymous/unlinked unchanged" → Tasks 2 + 3 + 8.
- "Manual setup: Google provider, Auth URL config, redirect URI, apply migration, link rows" → Task 9 + Task 7.
- "Testing: pure units associatedName + browser for auth/highlight" → Tasks 2/4/5 units, Task 9 browser.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. None found.

**3. Type/name consistency:** `associatedName(profile, players)` defined (Task 2) and called in Task 8 with `{ player_key }|null` + `state.players`; `renderAuthControl(user)` / `renderAccount(user, playerName)` defined (Tasks 4/5) and called in Task 8; `currentUser`/`onUserChange`/`signInWithGoogle`/`signOut`/`associatedPlayerKey` defined (Task 6) and all imported+used in Task 8; `renderLeaderboard(rows, sort, moves, highlightName)` extended (Task 3) and called with `state.associatedName` (Task 8); `loadSiteData` returns `{ tournaments, players }` (Task 1) consumed in Task 8. The `user` shape `{ id, email, name, avatarUrl }` from `auth.js` matches what `renderAuthControl`/`renderAccount` read. Consistent.

## Notes / risks

- **OAuth return + hash routing:** supabase-js (`detectSessionInUrl`, default on) parses and strips the `#access_token=…` fragment on return; the router's fallback (`showActiveTab`) safely ignores any transient unknown hash. `onUserChange` fires on the resulting session and re-renders.
- **Display-name match:** the highlight matches `players.display_name` against the Leaderboard row name; both derive from `round_results.player_name`, so they match. If a player's name ever varies across events, the linked name is one canonical pick — acceptable.
- **Security:** `profiles` select is own-row only (`auth.uid() = id`); no user write policies (admin uses the dashboard/service_role). Anonymous users have no `uid`, so they read no `profiles` rows and see no highlight. Keep Auth Google-only (setup step 3) so the public key can't self-register.
- **CDN isolation** stays intact: CDN + `supabase.auth` live only in `app.js`/`auth.js`, neither imported by tests.
