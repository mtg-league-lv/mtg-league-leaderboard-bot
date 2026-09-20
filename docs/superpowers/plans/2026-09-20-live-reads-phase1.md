# Live Reads (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the front-end from reading a deploy-time `web/data/tournaments.json` to reading **live from Supabase** in the browser via the public anon key, with no change to what any view renders.

**Architecture:** A pure `web/lib/site-data.js` ports `bot/export.py`'s `build_site_data` (raw rows → the `{ tournaments: [...] }` shape the views already consume). A thin `web/lib/supabase-data.js` pages the three tables through an injected client and calls it. `web/config.js` holds the public URL + anon key. `app.js boot()` creates a Supabase client (from a CDN ESM import — the only browser-only dependency, kept out of any test-imported module) and loads data live. Public read is unlocked by adding `for select using (true)` RLS policies; RLS is already **enabled** on all three tables with **zero policies**, so anon reads return nothing until these policies exist.

**Tech Stack:** Vanilla ES modules, `@supabase/supabase-js` v2 (CDN ESM), Node's built-in test runner (`node --test tests/web/*.test.mjs`), Supabase Postgres + RLS.

---

## Background facts (verified)

- Supabase project `shtatdxrwmiyzzvrfaai`. URL `https://shtatdxrwmiyzzvrfaai.supabase.co`. Publishable key `sb_publishable_TlpQ0uaZI_NSilYSe8R2fw_gpwfzNWF` (public by design). Legacy anon JWT is the fallback if the publishable key ever fails PostgREST auth.
- RLS status **now**: `tournaments`, `round_results`, `players` all have `relrowsecurity = true` and **0 policies**. The Discord bot/export uses `service_role`, which bypasses RLS, so it is unaffected.
- Tests run via `node --test tests/web/*.test.mjs` (see `.github/workflows/web-ci.yml`). Node cannot import `https://` URLs, so **no module imported by a test may `import` from the CDN**. The CDN import lives only in `app.js`, which no test imports.
- `bot/export.py` `build_site_data` is the reference behaviour; `tests/test_export.py` is the reference test set to port.
- Phase 1 leaves `web/data/tournaments.json`, `tests/web/seed-data.test.mjs`, and the export workflow step in place (harmless, unused; cleaned up later). Do not delete them.

## File Structure

- Create `web/config.js` — public Supabase URL + anon key constants. No imports.
- Create `web/lib/site-data.js` — pure `buildSiteData(tournaments, results, leagueKeys)`. No imports.
- Create `web/lib/supabase-data.js` — `fetchAll(client, table, cols)` + `loadSiteData(client)`. Imports only `./site-data.js`. No CDN import (client is injected).
- Modify `web/app.js` — `boot()` reads live via Supabase; adds the CDN `createClient` import and client creation. Rest unchanged.
- Create `tests/web/config.test.mjs`, `tests/web/site-data.test.mjs`, `tests/web/supabase-data.test.mjs`.
- Modify `supabase/schema.sql` — record the public read policies.
- Apply the same policies to the live DB via the Supabase `apply_migration` MCP tool.

---

### Task 1: Public Supabase config

**Files:**
- Create: `web/config.js`
- Test: `tests/web/config.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/web/config.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/web/config.test.mjs`
Expected: FAIL — cannot find module `../../web/config.js`.

- [ ] **Step 3: Create the config module**

Create `web/config.js`:

```js
// Public Supabase settings for the browser. The publishable/anon key is public
// by design — Row Level Security is the security boundary, not this value — so
// it is safe to commit and ship in the static site. See docs/superpowers/specs.
export const SUPABASE_URL = 'https://shtatdxrwmiyzzvrfaai.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_TlpQ0uaZI_NSilYSe8R2fw_gpwfzNWF';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/web/config.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/config.js tests/web/config.test.mjs
git commit -m "feat(web): add public Supabase config"
```

---

### Task 2: Pure `buildSiteData` port

**Files:**
- Create: `web/lib/site-data.js`
- Test: `tests/web/site-data.test.mjs`

This ports `bot/export.py` `build_site_data` (and `_player_obj`) exactly, including: sort tournaments by `event_date` ascending; sort rounds and pairings numerically; sort the (up to two) rows in a pairing by `player_key`; `player1` = first row, `player2` = second row or `null`; `id` stringified; `name` falls back to `"Tournament"`; `is_league` true when `leagueKeys` is `null`, else membership; `deck`/`deck_colours`/`standing` default to `null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/web/site-data.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSiteData } from '../../web/lib/site-data.js';

function res(tid, rnd, pr, name, key, gw, w, d, l, extra = {}) {
  return {
    tournament_id: tid, round: rnd, pairing: pr,
    player_name: name, player_key: key, game_wins: gw,
    record_wins: w, record_draws: d, record_losses: l, ...extra,
  };
}

test('full pairing produces two players with records', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0),
                   res(1, 1, 1, 'Bob', 'bob', 1, 0, 0, 1)];
  const t = buildSiteData(tournaments, results).tournaments[0];
  assert.equal(t.id, '1');
  assert.equal(t.date, '2026-07-06');
  const p = t.rounds[0].pairings[0];
  assert.equal(p.pairing, 1);
  assert.deepEqual(p.player1, {
    name: 'Ann', game_wins: 2, record: { wins: 1, draws: 0, losses: 0 },
    is_league: true, deck: null, deck_colours: null, standing: null,
  });
  assert.deepEqual(p.player2, {
    name: 'Bob', game_wins: 1, record: { wins: 0, draws: 0, losses: 1 },
    is_league: true, deck: null, deck_colours: null, standing: null,
  });
});

test('a bye is a single-row pairing with player2 null', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Cara', 'cara', 2, 1, 0, 0)];
  const p = buildSiteData(tournaments, results).tournaments[0].rounds[0].pairings[0];
  assert.equal(p.player1.name, 'Cara');
  assert.equal(p.player2, null);
});

test('player1 is deterministic by player_key regardless of input order', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Bob', 'bob', 1, 0, 0, 1),
                   res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0)];
  const p = buildSiteData(tournaments, results).tournaments[0].rounds[0].pairings[0];
  assert.equal(p.player1.name, 'Ann');
  assert.equal(p.player2.name, 'Bob');
});

test('tournaments sort by date; rounds sort numerically', () => {
  const tournaments = [{ id: 2, name: 'Later', event_date: '2026-08-01' },
                       { id: 1, name: 'Earlier', event_date: '2026-07-06' }];
  const results = [
    res(1, 2, 1, 'Ann', 'ann', 2, 2, 0, 0), res(1, 2, 1, 'Bob', 'bob', 1, 1, 0, 1),
    res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0), res(1, 1, 1, 'Bob', 'bob', 1, 0, 0, 1),
    res(2, 1, 1, 'Ann', 'ann', 2, 1, 0, 0), res(2, 1, 1, 'Zed', 'zed', 0, 0, 0, 1),
  ];
  const data = buildSiteData(tournaments, results);
  assert.deepEqual(data.tournaments.map(t => t.name), ['Earlier', 'Later']);
  assert.deepEqual(data.tournaments[0].rounds.map(r => r.round), [1, 2]);
});

test('null tournament name falls back to "Tournament"', () => {
  const tournaments = [{ id: 1, name: null, event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0)];
  assert.equal(buildSiteData(tournaments, results).tournaments[0].name, 'Tournament');
});

test('is_league reflects the league key set', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0),
                   res(1, 1, 1, 'Guest', 'guest', 1, 0, 0, 1)];
  const p = buildSiteData(tournaments, results, new Set(['ann']))
    .tournaments[0].rounds[0].pairings[0];
  const byName = { [p.player1.name]: p.player1, [p.player2.name]: p.player2 };
  assert.equal(byName.Ann.is_league, true);
  assert.equal(byName.Guest.is_league, false);
});

test('is_league defaults to true when no league keys are given', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0)];
  const p = buildSiteData(tournaments, results).tournaments[0].rounds[0].pairings[0];
  assert.equal(p.player1.is_league, true);
});

test('deck, colours and standing are carried through', () => {
  const tournaments = [{ id: 1, name: 'A', event_date: '2026-07-06' }];
  const results = [
    res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0,
        { player_deck: 'Izzet Prowess', player_deck_colours: 'UR', final_rank: 1 }),
    res(1, 1, 1, 'Bob', 'bob', 1, 0, 0, 1, { final_rank: 5 }),
  ];
  const p = buildSiteData(tournaments, results).tournaments[0].rounds[0].pairings[0];
  const byName = { [p.player1.name]: p.player1, [p.player2.name]: p.player2 };
  assert.equal(byName.Ann.deck, 'Izzet Prowess');
  assert.equal(byName.Ann.deck_colours, 'UR');
  assert.equal(byName.Ann.standing, 1);
  assert.equal(byName.Bob.deck, null);
  assert.equal(byName.Bob.deck_colours, null);
  assert.equal(byName.Bob.standing, 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web/site-data.test.mjs`
Expected: FAIL — cannot find module `../../web/lib/site-data.js`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/site-data.js`:

```js
// Pure port of bot/export.py build_site_data. Given raw Supabase rows, produce
// the { tournaments: [...] } shape the views already consume. Keep this in step
// with bot/export.py so live reads and the (legacy) JSON export never diverge.

function playerObj(row, leagueKeys) {
  return {
    name: row.player_name,
    game_wins: row.game_wins,
    record: {
      wins: row.record_wins,
      draws: row.record_draws,
      losses: row.record_losses,
    },
    is_league: leagueKeys == null ? true : leagueKeys.has(row.player_key),
    deck: row.player_deck ?? null,
    deck_colours: row.player_deck_colours ?? null,
    standing: row.final_rank ?? null,
  };
}

export function buildSiteData(tournaments, results, leagueKeys = null) {
  // grouped: tournament_id -> round -> pairing -> [rows]
  const grouped = new Map();
  for (const row of results) {
    if (!grouped.has(row.tournament_id)) grouped.set(row.tournament_id, new Map());
    const rounds = grouped.get(row.tournament_id);
    if (!rounds.has(row.round)) rounds.set(row.round, new Map());
    const pairings = rounds.get(row.round);
    if (!pairings.has(row.pairing)) pairings.set(row.pairing, []);
    pairings.get(row.pairing).push(row);
  }

  const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const byNumber = (a, b) => a - b;

  const outTournaments = [];
  for (const t of [...tournaments].sort((a, b) => byString(a.event_date, b.event_date))) {
    const roundsMap = grouped.get(t.id) ?? new Map();
    const roundsOut = [];
    for (const roundNo of [...roundsMap.keys()].sort(byNumber)) {
      const pairingsMap = roundsMap.get(roundNo);
      const pairingsOut = [];
      for (const pairingNo of [...pairingsMap.keys()].sort(byNumber)) {
        const rows = [...pairingsMap.get(pairingNo)].sort((a, b) =>
          byString(a.player_key, b.player_key),
        );
        pairingsOut.push({
          pairing: pairingNo,
          player1: playerObj(rows[0], leagueKeys),
          player2: rows.length > 1 ? playerObj(rows[1], leagueKeys) : null,
        });
      }
      roundsOut.push({ round: roundNo, pairings: pairingsOut });
    }
    outTournaments.push({
      id: String(t.id),
      name: t.name || 'Tournament',
      date: t.event_date,
      rounds: roundsOut,
    });
  }
  return { tournaments: outTournaments };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web/site-data.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/site-data.js tests/web/site-data.test.mjs
git commit -m "feat(web): pure buildSiteData port of bot export shape"
```

---

### Task 3: Thin Supabase data loader

**Files:**
- Create: `web/lib/supabase-data.js`
- Test: `tests/web/supabase-data.test.mjs`

The loader pages each table (PostgREST caps a single response at ~1000 rows) and composes `buildSiteData`. The Supabase client is **injected** so this module has no CDN import and is testable in Node with a fake client. It mirrors `bot/export.py` `_fetch_all` / `_fetch` and the fake in `tests/test_export.py`.

- [ ] **Step 1: Write the failing tests**

Create `tests/web/supabase-data.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAll, loadSiteData } from '../../web/lib/supabase-data.js';

// Fake client mirroring the supabase-js query chain: from().select().range()
// resolves to { data, error }. range() slices to mimic PostgREST paging.
class FakeBuilder {
  constructor(rows) { this.rows = rows; }
  select() { return this; }
  async range(start, end) {
    return { data: this.rows.slice(start, end + 1), error: null };
  }
}
class FakeClient {
  constructor(tables) { this.tables = tables; }
  from(name) { return new FakeBuilder(this.tables[name] ?? []); }
}

function res(tid, rnd, pr, name, key, gw, w, d, l) {
  return {
    tournament_id: tid, round: rnd, pairing: pr, player_name: name,
    player_key: key, game_wins: gw, record_wins: w, record_draws: d, record_losses: l,
  };
}

test('fetchAll pages past the 1000-row cap', async () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ n: i }));
  const client = new FakeClient({ big: rows });
  const got = await fetchAll(client, 'big', 'n');
  assert.equal(got.length, 2500);
  assert.equal(got[0].n, 0);
  assert.equal(got[2499].n, 2499);
});

test('fetchAll throws on a query error', async () => {
  const client = {
    from: () => ({ select: () => ({ range: async () => ({ data: null, error: new Error('boom') }) }) }),
  };
  await assert.rejects(() => fetchAll(client, 'x', 'c'), /boom/);
});

test('loadSiteData composes tables into the site shape with league flags', async () => {
  const client = new FakeClient({
    tournaments: [{ id: 1, name: 'A', event_date: '2026-07-06' }],
    round_results: [res(1, 1, 1, 'Ann', 'ann', 2, 1, 0, 0),
                    res(1, 1, 1, 'Guest', 'guest', 1, 0, 0, 1)],
    players: [{ player_key: 'ann', is_league: true },
              { player_key: 'guest', is_league: false }],
  });
  const data = await loadSiteData(client);
  const p = data.tournaments[0].rounds[0].pairings[0];
  const byName = { [p.player1.name]: p.player1, [p.player2.name]: p.player2 };
  assert.equal(byName.Ann.is_league, true);
  assert.equal(byName.Guest.is_league, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web/supabase-data.test.mjs`
Expected: FAIL — cannot find module `../../web/lib/supabase-data.js`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/supabase-data.js`:

```js
// Thin I/O wrapper: page the three tables through an injected Supabase client
// and build the site shape. The client is a parameter (never imported here) so
// the module carries no CDN dependency and is unit-testable in Node.
import { buildSiteData } from './site-data.js';

const PAGE_SIZE = 1000;

const TOURNAMENT_COLS = 'id, name, event_date';
const RESULT_COLS =
  'tournament_id, round, pairing, final_rank, player_name, player_key, ' +
  'game_wins, record_wins, record_draws, record_losses, ' +
  'player_deck, player_deck_colours';
const PLAYER_COLS = 'player_key, is_league';

export async function fetchAll(client, table, cols) {
  // PostgREST caps a single response (~1000 rows); page explicitly so a dropped
  // round_results row never renders as a false bye.
  const rows = [];
  let start = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(cols)
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return rows;
}

export async function loadSiteData(client) {
  const [tournaments, results, players] = await Promise.all([
    fetchAll(client, 'tournaments', TOURNAMENT_COLS),
    fetchAll(client, 'round_results', RESULT_COLS),
    fetchAll(client, 'players', PLAYER_COLS),
  ]);
  const leagueKeys = new Set(
    players.filter(p => p.is_league).map(p => p.player_key),
  );
  return buildSiteData(tournaments, results, leagueKeys);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web/supabase-data.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/supabase-data.js tests/web/supabase-data.test.mjs
git commit -m "feat(web): paged Supabase data loader"
```

---

### Task 4: Public read RLS policies

**Files:**
- Modify: `supabase/schema.sql` (append; record for the repo)
- Apply to live DB via the `apply_migration` MCP tool (Supabase project `shtatdxrwmiyzzvrfaai`).

RLS is already enabled on the three tables with no policies, so anon reads return nothing today. Add an idempotent public `select` policy per table. `service_role` bypasses RLS and is unaffected. This is additive and safe: the same data is already public via the deployed JSON.

- [ ] **Step 1: Record the policies in `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql

-- Public read access for the browser (anon key). RLS is the security boundary;
-- these SELECT policies expose exactly the data already published in the static
-- site. The Discord bot/export uses service_role, which bypasses RLS. Writes
-- remain closed (no INSERT/UPDATE/DELETE policies) — added in a later phase.
alter table tournaments   enable row level security;
alter table round_results enable row level security;
alter table players       enable row level security;

drop policy if exists "public read tournaments"   on tournaments;
drop policy if exists "public read round_results"  on round_results;
drop policy if exists "public read players"        on players;

create policy "public read tournaments"  on tournaments
  for select to anon, authenticated using (true);
create policy "public read round_results" on round_results
  for select to anon, authenticated using (true);
create policy "public read players"       on players
  for select to anon, authenticated using (true);
```

- [ ] **Step 2: Apply the migration to the live database**

Use the Supabase `apply_migration` MCP tool with `project_id: shtatdxrwmiyzzvrfaai`, `name: public_read_policies`, and `query` set to exactly the SQL block from Step 1 (the `alter table … enable`, `drop policy if exists …`, and `create policy …` statements). Applying it twice is safe (drops precede creates).

- [ ] **Step 3: Verify anon reads now succeed**

Run this check with the `execute_sql` MCP tool (`project_id: shtatdxrwmiyzzvrfaai`):

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('tournaments', 'round_results', 'players')
order by tablename;
```

Expected: three rows, one `SELECT` policy per table, `roles` including `anon` and `authenticated`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): public read RLS policies for live browser reads"
```

---

### Task 5: Wire `app.js` to live reads

**Files:**
- Modify: `web/app.js:1-28` (imports + `boot()`)

Replace the `fetch('data/tournaments.json')` load with a live Supabase read. The CDN `createClient` import is added here and only here (no test imports `app.js`). Keep the existing error UI so a failed load still shows "Couldn't load data." The rest of `boot()` and all `setup*` functions are unchanged.

- [ ] **Step 1: Add imports**

At the top of `web/app.js`, add these three imports below the existing import block (after line 8, `import { playerProfile, attendedDates } from './lib/player-stats.js';`):

```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { loadSiteData } from './lib/supabase-data.js';
```

- [ ] **Step 2: Replace the data load in `boot()`**

In `web/app.js`, replace this block:

```js
  try {
    const response = await fetch('data/tournaments.json');
    if (!response.ok) throw new Error('bad status');
    state.tournaments = (await response.json()).tournaments;
  } catch {
    const message = '<div class="empty">Couldn\'t load data.</div>';
    document.getElementById('lb-body').innerHTML = message;
    document.getElementById('td-body').innerHTML = message;
    return;
  }
```

with:

```js
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.tournaments = (await loadSiteData(client)).tournaments;
  } catch {
    const message = '<div class="empty">Couldn\'t load data.</div>';
    document.getElementById('lb-body').innerHTML = message;
    document.getElementById('td-body').innerHTML = message;
    return;
  }
```

- [ ] **Step 3: Run the whole web suite (nothing should regress)**

Run: `node --test tests/web/*.test.mjs`
Expected: PASS — all existing suites plus the three new ones. `app.js` is not imported by any test, so the CDN import is never evaluated in Node.

- [ ] **Step 4: Commit**

```bash
git add web/app.js
git commit -m "feat(web): load leaderboard data live from Supabase"
```

---

### Task 6: Browser verification (live, anonymous)

**Files:** none (manual verification).

- [ ] **Step 1: Serve `web/` and open it in the browser**

Start a static server for the `web/` directory (e.g. a launch config running `python -m http.server 8000` with cwd `web/`, or an equivalent), then open the served URL in the built-in browser. A plain `file://` open will fail CORS/module rules — serve over http.

- [ ] **Step 2: Verify live data renders anonymously**

With no sign-in:
- Leaderboard tab: rows render; season selector lists seasons; the meta line shows a tournament/player count > 0.
- Tournament tab: switching season + tournament renders rounds/pairings, decks, mana pips.
- Click a player name → Player Profile route renders placements/decks.

Confirm via `read_page` / `get_page_text` that real rows are present (not the "Couldn't load data." message), and check the browser console for no errors (especially no PostgREST permission errors — those would mean Task 4 was skipped).

- [ ] **Step 3: Cross-check counts against the database**

Run with `execute_sql` (`project_id: shtatdxrwmiyzzvrfaai`): `select count(*) from tournaments;` and confirm the Leaderboard/Tournament UI reflects the same number of tournaments the DB reports.

- [ ] **Step 4: No commit** (verification only). If issues surface, fix in the relevant task's files and re-run its tests before re-verifying.

---

## Self-Review

**1. Spec coverage (Phase 1 sections of the design spec):**
- "Add `web/config.js` (public URL + anon key)" → Task 1.
- "port `build_site_data` into a pure `web/lib/site-data.js`" → Task 2.
- "thin `web/lib/supabase-data.js` fetching 3 tables (paged)" → Task 3.
- "enable RLS + public `for select using (true)`" → Task 4 (RLS already enabled; adds the missing policies).
- "`app.js boot()` reads live instead of `fetch('data/tournaments.json')`" → Task 5.
- "export step/tournaments.json become unused; leave for now" → honored (untouched; `seed-data.test.mjs` still green).
- "Testing: pure units `buildSiteData`, config presence; browser for anonymous render" → Tasks 2, 1, 3, 6.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. None found.

**3. Type/name consistency:** `buildSiteData(tournaments, results, leagueKeys)` defined in Task 2 and called in Task 3 with the same arity; `fetchAll(client, table, cols)` and `loadSiteData(client)` defined in Task 3 and `loadSiteData` used in Task 5; `SUPABASE_URL` / `SUPABASE_ANON_KEY` defined in Task 1 and imported in Task 5. Output object keys (`name`, `game_wins`, `record`, `is_league`, `deck`, `deck_colours`, `standing`, and tournament `id`/`name`/`date`/`rounds`, pairing `pairing`/`player1`/`player2`) match `bot/export.py` and the existing views/`seed-data.test.mjs`. Consistent.

## Notes / risks

- **Publishable vs legacy key:** The plan uses the modern `sb_publishable_…` key. If PostgREST rejects it (401/`invalid api key`), fall back to the legacy anon JWT for `SUPABASE_ANON_KEY` in `web/config.js` — same public-by-design semantics.
- **CDN import isolation** is load-bearing for CI: keep the `createClient` import out of every module a test imports (currently only `app.js` has it).
- **No redeploy needed after imports** once live — that's the payoff. `web/data/tournaments.json` goes stale but stays until the later cleanup phase.
