# Player deck self-edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in, admin-linked player set their own deck name/colors for a tournament from a "You've played" section in the Tournament view, writing through a single Supabase Edge Function that enforces ownership and a 7-day window server-side.

**Architecture:** Pure helpers (`normalizeColours`, `isWithinDays`) and a pure `renderYouvePlayed` renderer are unit-tested; `renderTournament` gains an optional `viewer`. A thin `deck-edit.js` calls the `set-deck` Edge Function; `app.js` wires the form and refreshes data after a save. `round_results` stays write-closed; the function (service_role) is the only writer.

**Tech Stack:** Vanilla ES modules, Supabase Edge Functions (Deno/TS), supabase-js Functions + Auth, `node --test`.

---

## Background facts (verified)

- On `main`: auth (`web/lib/auth.js`), `profiles` table (own-row RLS), live reads, `state.user`/`state.associatedName` in `app.js`, and `renderTournament(tournament)` in `web/ui/tournament-view.js` which renders `finalStandings` and the `Final standings` section-label.
- `finalStandings(tournament)` yields per-player `{ name, deck, deck_colours, record, ... }`; deck is uniform across a player's rows in an event.
- `round_results` columns: `player_deck text`, `player_deck_colours text`, keyed `(tournament_id, round, player_key)`. RLS: public SELECT only; no write policy.
- `manaIcons(colours)` renders pips from a WUBRG string; mana SVGs exist for W/U/B/R/G.
- Tests run `node --test tests/web/*.test.mjs`. No test may import a CDN URL; keep CDN/`functions.invoke` in `app.js`/`deck-edit.js` (not test-imported).
- Supabase project `shtatdxrwmiyzzvrfaai`. Deploy the function via the `deploy_edge_function` MCP tool.

## File Structure

- Create `web/lib/deck.js` — pure `normalizeColours`, `isWithinDays`.
- Create `web/lib/deck-edit.js` — thin `saveDeck(client, …)`.
- Modify `web/ui/tournament-view.js` — `renderYouvePlayed` + `renderTournament(tournament, viewer)`.
- Modify `web/app.js` — compute `viewer`, pass it in, wire pip toggles + Save + refresh.
- Modify `web/styles.css` — "You've played" section + pip-toggle styles.
- Create `supabase/functions/set-deck/index.ts` — the Edge Function.
- Tests: `tests/web/deck.test.mjs`, and append to `tests/web/tournament-view.test.mjs`.

---

### Task 1: Pure deck helpers

**Files:**
- Create: `web/lib/deck.js`
- Test: `tests/web/deck.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/web/deck.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeColours, isWithinDays } from '../../web/lib/deck.js';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/deck.test.mjs`
Expected: FAIL — cannot find module `../../web/lib/deck.js`.

- [ ] **Step 3: Write `web/lib/deck.js`**

```js
// Pure deck helpers shared by the Tournament view and the edit gate.
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

// Canonical WUBRG-ordered, de-duplicated colour string from any letters.
export function normalizeColours(input) {
  if (!input) return '';
  const chars = Array.isArray(input) ? input : String(input).split('');
  const seen = new Set(chars.map(c => String(c).toUpperCase()));
  return WUBRG.filter(c => seen.has(c)).join('');
}

// True while `now` is before `eventDate` + `days` (UTC-midnight based), i.e.
// fewer than `days` full days have passed. day (days-1) → true, day `days` → false.
export function isWithinDays(eventDate, now, days) {
  const deadline = new Date(`${eventDate}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return now.getTime() < deadline.getTime();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/web/deck.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/deck.js tests/web/deck.test.mjs
git commit -m "feat(web): pure deck colour + window helpers"
```

---

### Task 2: "You've played" renderer

**Files:**
- Modify: `web/ui/tournament-view.js`
- Test: `tests/web/tournament-view.test.mjs` (append)

Add `renderYouvePlayed(entry, editable)` and an optional `viewer` param to `renderTournament`. `entry` = `{ name, deck, deck_colours }`; `viewer` = `{ name, editable } | null`.

- [ ] **Step 1: Write the failing tests (append to `tests/web/tournament-view.test.mjs`)**

```js
import { renderYouvePlayed } from '../../web/ui/tournament-view.js';

test('renderYouvePlayed shows an editable form with colours pre-selected', () => {
  const html = renderYouvePlayed({ name: 'Ann', deck: 'Izzet', deck_colours: 'UR' }, true);
  assert.ok(html.includes("You've played"));
  assert.ok(html.includes('data-pip="U"'));
  assert.ok(html.includes('data-pip="R"'));
  // Selected pips carry the selected marker; unselected do not.
  assert.match(html, /data-pip="U"[^>]*\bselected\b/);
  assert.doesNotMatch(html, /data-pip="G"[^>]*\bselected\b/);
  assert.ok(html.includes('value="Izzet"'));
  assert.ok(html.includes('id="deck-save"'));
});

test('renderYouvePlayed is read-only when not editable', () => {
  const html = renderYouvePlayed({ name: 'Ann', deck: 'Izzet', deck_colours: 'UR' }, false);
  assert.ok(html.includes("You've played"));
  assert.ok(!html.includes('id="deck-save"'));
  assert.ok(html.includes('Izzet'));
});

test('renderYouvePlayed read-only with no deck shows a placeholder', () => {
  const html = renderYouvePlayed({ name: 'Ann', deck: null, deck_colours: null }, false);
  assert.ok(html.includes('No deck recorded yet'));
});

test('renderTournament prepends the section for a participating viewer', () => {
  const t = {
    id: '1', name: 'A', date: '2026-07-06',
    rounds: [{ round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: { wins: 1, draws: 0, losses: 0 } },
        player2: { name: 'Bob', game_wins: 1, record: { wins: 0, draws: 0, losses: 1 } } },
    ] }],
  };
  const html = renderTournament(t, { name: 'Ann', editable: true });
  assert.ok(html.indexOf("You've played") < html.indexOf('Final standings'));
});

test('renderTournament shows no section when the viewer did not play', () => {
  const t = {
    id: '1', name: 'A', date: '2026-07-06',
    rounds: [{ round: 1, pairings: [
      { pairing: 1, player1: { name: 'Ann', game_wins: 2, record: { wins: 1, draws: 0, losses: 0 } },
        player2: { name: 'Bob', game_wins: 1, record: { wins: 0, draws: 0, losses: 1 } } },
    ] }],
  };
  assert.ok(!renderTournament(t, { name: 'Zoe', editable: true }).includes("You've played"));
  assert.ok(!renderTournament(t, null).includes("You've played"));
});
```

(The file already imports `renderTournament`; add the `renderYouvePlayed` import at the top as shown.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web/tournament-view.test.mjs`
Expected: FAIL — `renderYouvePlayed` is not exported / `viewer` ignored.

- [ ] **Step 3: Implement in `web/ui/tournament-view.js`**

Add near the top (after the imports), a WUBRG constant and the renderer:

```js
const PIPS = ['W', 'U', 'B', 'R', 'G'];

// The linked viewer's own deck for this event. `entry` = { name, deck,
// deck_colours }; editable → a pip+name form, else a read-only display.
export function renderYouvePlayed(entry, editable) {
  const label = '<div class="section-label">You\'ve played</div>';
  if (editable) {
    const selected = new Set((entry.deck_colours || '').split(''));
    const pips = PIPS.map(c =>
      `<button type="button" class="pip-toggle${selected.has(c) ? ' selected' : ''}" ` +
      `data-pip="${c}" aria-pressed="${selected.has(c)}" aria-label="${c}">` +
      `<img src="icons/mana/${c}.svg" alt="${c}" /></button>`,
    ).join('');
    return (
      label +
      '<div class="youve-played editing">' +
      `<div class="pip-row">${pips}</div>` +
      `<input id="deck-name" class="deck-name-input" type="text" maxlength="60" ` +
      `placeholder="Deck name" value="${entry.deck ? entry.deck.replace(/"/g, '&quot;') : ''}" />` +
      '<button id="deck-save" class="auth-signin" type="button">Save</button>' +
      '<span id="deck-status" class="deck-status" role="status"></span>' +
      '</div>'
    );
  }
  const body = (entry.deck || entry.deck_colours)
    ? `<span class="deck-info">${manaIcons(entry.deck_colours)}` +
      `${entry.deck ? `<span class="deck-name">${entry.deck}</span>` : ''}</span>`
    : '<span class="profile-empty">No deck recorded yet</span>';
  return label + `<div class="youve-played">${body}</div>`;
}
```

Change the signature of `renderTournament` and prepend the section. Replace:

```js
export function renderTournament(tournament) {
  const standings = finalStandings(tournament);
```

with:

```js
export function renderTournament(tournament, viewer = null) {
  const standings = finalStandings(tournament);
  const mine = viewer && standings.find(s => s.player.name === viewer.name);
  const youvePlayed = mine
    ? renderYouvePlayed(
        { name: mine.player.name, deck: mine.player.deck, deck_colours: mine.player.deck_colours },
        viewer.editable,
      )
    : '';
```

In the standings-only (`isStandingsEvent`) early return, include the section — change:

```js
  if (isStandingsEvent(tournament)) {
    return tournamentHeader(tournament, `${standings.length} players`) +
      renderStandingsTable(standings);
  }
```

to:

```js
  if (isStandingsEvent(tournament)) {
    return tournamentHeader(tournament, `${standings.length} players`) +
      youvePlayed +
      renderStandingsTable(standings);
  }
```

And in the main return, prepend before "Final standings" — change:

```js
  return (
    tournamentHeader(tournament, `${standings.length} players · ${tournament.rounds.length} rounds`) +
    '<div class="section-label">Final standings</div>' +
```

to:

```js
  return (
    tournamentHeader(tournament, `${standings.length} players · ${tournament.rounds.length} rounds`) +
    youvePlayed +
    '<div class="section-label">Final standings</div>' +
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/web/tournament-view.test.mjs`
Expected: PASS (existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add web/ui/tournament-view.js tests/web/tournament-view.test.mjs
git commit -m "feat(web): You've played section in the tournament view"
```

---

### Task 3: Styles

**Files:**
- Modify: `web/styles.css` (append)

- [ ] **Step 1: Append styles**

```css
.youve-played { padding: 6px 0 4px; }
.youve-played.editing { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pip-row { display: flex; gap: 6px; }
.pip-toggle {
  width: 34px; height: 34px; padding: 4px; cursor: pointer;
  border: 1px solid var(--border); border-radius: 50%;
  background: var(--bg); opacity: 0.4; transition: opacity 0.1s;
}
.pip-toggle.selected { opacity: 1; border-color: var(--accent-text); }
.pip-toggle img { width: 100%; height: 100%; display: block; }
.deck-name-input {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text); font-size: 14px; min-width: 160px;
}
.deck-status { font-size: 13px; color: var(--muted); }
```

- [ ] **Step 2: Commit**

```bash
git add web/styles.css
git commit -m "style(web): You've played form and pip toggles"
```

---

### Task 4: Save wrapper

**Files:**
- Create: `web/lib/deck-edit.js`

Thin browser-only wrapper (no unit test; not imported by tests).

- [ ] **Step 1: Write `web/lib/deck-edit.js`**

```js
// Thin wrapper over the set-deck Edge Function. Browser-only I/O; the function
// enforces ownership + the 7-day window server-side.
export async function saveDeck(client, { tournamentId, deckName, deckColours }) {
  const { data, error } = await client.functions.invoke('set-deck', {
    body: { tournament_id: tournamentId, deck_name: deckName, deck_colours: deckColours },
  });
  if (error) throw error;
  return data; // { deck, deck_colours }
}
```

- [ ] **Step 2: Sanity check**

Run: `node --check web/lib/deck-edit.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/lib/deck-edit.js
git commit -m "feat(web): saveDeck edge-function wrapper"
```

---

### Task 5: Edge Function `set-deck`

**Files:**
- Create: `supabase/functions/set-deck/index.ts`
- Deploy via the `deploy_edge_function` MCP tool (project `shtatdxrwmiyzzvrfaai`).

- [ ] **Step 1: Write `supabase/functions/set-deck/index.ts`**

```ts
// Sole writer for player deck info. Enforces ownership (player_key comes from
// the caller's profile, never the body) and the 7-day edit window server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeColours(input: unknown): string {
  if (!input) return '';
  const chars = Array.isArray(input) ? input : String(input).split('');
  const seen = new Set(chars.map((c) => String(c).toUpperCase()));
  return WUBRG.filter((c) => seen.has(c)).join('');
}

function withinWindow(eventDate: string, days: number): boolean {
  const deadline = new Date(`${eventDate}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return Date.now() < deadline.getTime();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their JWT.
  const authed = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await authed.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  // Service-role client for the profile lookup and the write (bypasses RLS).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: profile } = await admin
    .from('profiles').select('player_key').eq('id', user.id).maybeSingle();
  if (!profile || !profile.player_key) return json({ error: 'account not linked' }, 403);

  let body: { tournament_id?: unknown; deck_name?: unknown; deck_colours?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const tournamentId = body.tournament_id;
  if (!tournamentId) return json({ error: 'tournament_id required' }, 400);

  const { data: tourney } = await admin
    .from('tournaments').select('event_date').eq('id', tournamentId).maybeSingle();
  if (!tourney) return json({ error: 'tournament not found' }, 404);
  if (!withinWindow(tourney.event_date, 7)) return json({ error: 'edit window closed' }, 403);

  const colours = normalizeColours(body.deck_colours) || null;
  const name = (typeof body.deck_name === 'string' ? body.deck_name.trim().slice(0, 60) : '') || null;

  const { error } = await admin
    .from('round_results')
    .update({ player_deck: name, player_deck_colours: colours })
    .eq('tournament_id', tournamentId)
    .eq('player_key', profile.player_key);
  if (error) return json({ error: error.message }, 500);

  return json({ deck: name, deck_colours: colours });
});
```

- [ ] **Step 2: Deploy the function**

Use the `deploy_edge_function` MCP tool: `project_id: shtatdxrwmiyzzvrfaai`, `name: set-deck`, and the file content above as the entrypoint (`index.ts`). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions by the platform.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/set-deck/index.ts
git commit -m "feat(edge): set-deck function (ownership + 7-day enforced)"
```

---

### Task 6: Wire the Tournament view in `app.js`

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add imports**

Below the existing imports add:

```js
import { isWithinDays, normalizeColours } from './lib/deck.js';
import { saveDeck } from './lib/deck-edit.js';
```

- [ ] **Step 2: Compute the viewer and pass it into `renderTournament`, plus wire the form**

In `setupTournaments()`, replace the `render` function and event wiring. Change:

```js
  function render() {
    const tournament = state.tournaments.find(t => t.id === select.value);
    document.getElementById('td-body').innerHTML = tournament
      ? renderTournament(tournament)
      : '<div class="empty">No tournaments this season.</div>';
  }
  seasonSelect.addEventListener('change', () => { populateTournaments(); render(); });
  select.addEventListener('change', render);
  populateTournaments();
  render();
}
```

with:

```js
  const body = document.getElementById('td-body');

  function viewerFor(tournament) {
    if (!state.user || !state.associatedName) return null;
    return {
      name: state.associatedName,
      editable: isWithinDays(tournament.date, new Date(), 7),
    };
  }
  function render() {
    const tournament = state.tournaments.find(t => t.id === select.value);
    body.innerHTML = tournament
      ? renderTournament(tournament, viewerFor(tournament))
      : '<div class="empty">No tournaments this season.</div>';
  }

  body.addEventListener('click', async event => {
    const pip = event.target.closest('.pip-toggle');
    if (pip) {
      const on = pip.classList.toggle('selected');
      pip.setAttribute('aria-pressed', String(on));
      return;
    }
    if (!event.target.closest('#deck-save')) return;
    const tournament = state.tournaments.find(t => t.id === select.value);
    if (!tournament) return;
    const colours = normalizeColours(
      [...body.querySelectorAll('.pip-toggle.selected')].map(p => p.dataset.pip),
    );
    const deckName = body.querySelector('#deck-name').value;
    const status = body.querySelector('#deck-status');
    const saveBtn = body.querySelector('#deck-save');
    status.textContent = 'Saving…';
    saveBtn.disabled = true;
    try {
      await saveDeck(client, { tournamentId: tournament.id, deckName, deckColours: colours });
      const data = await loadSiteData(client);
      state.tournaments = data.tournaments;
      state.players = data.players;
      render();
      if (state.renderLeaderboard) state.renderLeaderboard();
    } catch {
      status.textContent = "Couldn't save. Try again.";
      saveBtn.disabled = false;
    }
  });

  seasonSelect.addEventListener('change', () => { populateTournaments(); render(); });
  select.addEventListener('change', render);
  populateTournaments();
  render();
}
```

- [ ] **Step 3: Re-render the Tournament view on auth change**

So the section appears/disappears at sign-in/out, expose the Tournament render like the leaderboard. Add `state.renderTournament = render;` right before the final `render();` in `setupTournaments`. Then, in `boot()`'s `onUserChange` callback, after `if (state.renderLeaderboard) state.renderLeaderboard();` add:

```js
    if (state.renderTournament) state.renderTournament();
```

And add `renderTournament: null` to the initial `state` object literal. (Note: the imported renderer is used as `renderTournament(...)` inside `setupTournaments`; the state field is a different name only if you rename — keep the state field as `renderTournamentView` to avoid shadowing the import.)

To avoid the name clash with the imported `renderTournament`, use `state.renderTournamentView`:
- initial state: add `renderTournamentView: null,`
- end of `setupTournaments`: `state.renderTournamentView = render;`
- in `onUserChange`: `if (state.renderTournamentView) state.renderTournamentView();`

- [ ] **Step 4: Run the whole suite**

Run: `node --test tests/web/*.test.mjs`
Expected: PASS (all suites). `app.js`/`deck-edit.js` are not imported by tests.

- [ ] **Step 5: Commit**

```bash
git add web/app.js
git commit -m "feat(web): wire You've played editing + refresh"
```

---

### Task 7: Browser verification

**Files:** none.

- [ ] **Step 1: Serve `web/` over http and open it.**
- [ ] **Step 2: Anonymous** — Tournament view shows no "You've played". No console errors.
- [ ] **Step 3: Signed in + linked + participant, event < 7 days** — the form shows with current colours pre-selected; toggle pips, type a name, Save → status clears, the deck appears in the section and in Final standings after refresh. (Requires a provider enabled + a `profiles` link.)
- [ ] **Step 4: Event ≥ 7 days** — read-only (or "No deck recorded yet").
- [ ] **Step 5: Security spot-check** — in devtools, call the function with a different `player_key` in the body and confirm it does not change another player's deck (server ignores body key); an out-of-window tournament returns 403.

---

## Self-Review

**1. Spec coverage:** section above Final standings (Task 2); shows colours+name (Task 2); editable via pips when <7 days (Tasks 1,2,6); read-only ≥7 days (Tasks 1,2); ownership + 7-day server-enforced (Task 5); only linked participant sees it (Tasks 2,6); anonymous unchanged (Tasks 2,6). Covered.

**2. Placeholder scan:** No TBD/TODO; all code and commands shown.

**3. Type/name consistency:** `normalizeColours`/`isWithinDays` defined (Task 1) and used in Task 6 and mirrored in Task 5; `renderYouvePlayed`/`renderTournament(tournament, viewer)` defined (Task 2) and used in Task 6; `saveDeck(client, {tournamentId, deckName, deckColours})` defined (Task 4) and called (Task 6); function body/colours keys (`player_deck`, `player_deck_colours`, `tournament_id`, `player_key`) match the schema; the `state.renderTournamentView` field avoids clashing with the imported `renderTournament`.

## Notes / risks

- The function reads `SUPABASE_SERVICE_ROLE_KEY` from the platform-injected env — never shipped to the browser.
- `functions.invoke` sends the user's JWT automatically once signed in.
- Client `isWithinDays` only gates the UI; the function is authoritative.
