# User accounts + live data — design

## Goal

Let visitors sign in with Google, see a personal **Account** page, and (when an
admin has linked their account to a player) have **their** player highlighted on
the Leaderboard. Along the way, move the site from a baked static export to
**live reads** from Supabase, laying a write‑ready foundation for later.

Requested behaviour:
1. Sign in with a Google OAuth social login.
2. A user **Account** page reached via a top‑right avatar.
3. A logged‑in user can be **associated to a player** — the association is set
   manually by an admin in the Supabase dashboard.
4. When logged in **and** associated, that player's Leaderboard row is
   highlighted with a light‑blue background.

## Non‑negotiables

- **All league data stays public — no login required.** Anonymous visitors read
  the Leaderboard, Tournaments, and Player Profiles exactly as today. Login is
  purely additive: it is required only for the Account page and to compute the
  viewer's own highlight. Nothing public is gated.
- **Write‑ready.** Users will need to write later; the auth model and RLS are
  keyed on `auth.uid()` so write policies drop in without rearchitecting.
- The `service_role` used by the Discord bot / export bypasses RLS and is
  unaffected.

## Architecture shift

Today the browser fetches a deploy‑time `web/data/tournaments.json`. We move to
the browser reading **live from Supabase** via `supabase-js` with the public
**anon key**. Consequences:

- Data changes appear immediately — no redeploy after an import.
- RLS must be enabled. The data is already fully public via the deployed JSON,
  so live public reads are **no new exposure**; RLS just makes it explicit.

Delivered in two phases, each its own PR.

## Phase 1 — Live reads (no auth)

- **Client:** load `@supabase/supabase-js` (v2) from a CDN (ESM). Add
  `web/config.js` exporting the public `SUPABASE_URL` and `SUPABASE_ANON_KEY`
  (public values; safe to commit).
- **Data loader:** port `bot/export.py`'s `build_site_data` into a pure
  `web/lib/site-data.js` `buildSiteData(tournaments, results, players)` returning
  the exact `{ tournaments: [...] }` shape the views already consume (rounds →
  pairings, byes, decks, `standing`/`final_rank`, `is_league`). A thin
  `web/lib/supabase-data.js` fetches the three tables (paged) and calls it.
- **Wiring:** `app.js boot()` loads data via Supabase instead of
  `fetch('data/tournaments.json')`; the rest of the app is unchanged (same shape).
- **RLS:** enable RLS on `tournaments`, `round_results`, `players` and add a
  public read policy `for select using (true)` (role `anon, authenticated`).
- **Byproduct:** the pages‑workflow export step and `tournaments.json` become
  unused. Leave them in place this phase (harmless); remove in a later cleanup.
  The Discord bot and `bot/export.py` are untouched.

## Phase 2 — Auth + Account page + association + highlight

- **Auth:** a shared `web/lib/auth.js` wraps `supabase.auth` —
  `signInWithOAuth({ provider: 'google', options: { redirectTo } })`,
  `signOut()`, and `onAuthStateChange`. The redirect target is the site's Pages
  URL.
- **Top‑right avatar (topbar):** logged out → a "Sign in" button; logged in →
  the Google avatar (from `user_metadata`) linking to the Account route. Auth
  state is resolved on load and updates reactively.
- **Account page** (`#account` route, alongside the existing hash router): shows
  the Google name / email / avatar, the associated player (a link to their
  `#player/<name>`, or "Not linked yet — ask an admin"), and a Sign out button.
  Reached only via the avatar; deep‑linking `#account` while logged out shows a
  "Sign in to view your account" prompt.
- **`profiles` table:**
  `id uuid primary key references auth.users(id) on delete cascade`,
  `player_key text references players(player_key)`, `created_at timestamptz`.
  The admin sets `player_key` manually in the dashboard. **RLS:** a user may
  `select` only their own row (`auth.uid() = id`). (No user writes this phase.)
- **Highlight:** after login, read the viewer's `profiles` row → `player_key` →
  map to the display name via the live `players` data. A pure
  `associatedName(profile, players)` returns that name (or null); the Leaderboard
  renderer adds a light‑blue background class to the matching row. Leaderboard
  only, per spec. Anonymous or unlinked users see no highlight (unchanged view).

## Manual setup (admin, once) — exact values provided at implementation

- Auth → Providers → Google: enable with a Google OAuth client id/secret.
- Auth → URL configuration: Site URL + redirect allowlist include the Pages URL.
- Google OAuth client: authorized redirect URI
  `https://<project>.supabase.co/auth/v1/callback`.
- Apply the `profiles` migration and the public‑read policies (provided as SQL).
- Link accounts to players by inserting/editing `profiles` rows in the dashboard.

## Components / boundaries

- `web/config.js` — public Supabase URL + anon key.
- `web/lib/site-data.js` — pure `buildSiteData(...)` (unit‑tested).
- `web/lib/supabase-data.js` — fetch tables + build (thin I/O wrapper).
- `web/lib/auth.js` — auth wrapper (Phase 2).
- `web/ui/account-view.js` — Account page renderer (pure) (Phase 2).
- `web/ui/topbar-*` / `app.js` — avatar + routing (Phase 2).
- `web/lib/highlight.js` (or a helper) — pure `associatedName(...)` (Phase 2).

## Testing

- **Pure units:** `buildSiteData` (rounds/pairings/byes/decks/standing/is_league)
  reusing the Python export fixtures; `associatedName` (linked / unlinked /
  anonymous); config presence. Existing web suite stays green.
- **Browser:** Phase 1 — leaderboard/tournaments/profiles render from live data,
  anonymous. Phase 2 — Google login/logout, avatar, Account page, deep‑links,
  and the highlight for a linked user; anonymous view unchanged.

## Risks / notes

- The anon key is public by design; **RLS is the security boundary**. No new data
  exposure vs the current public JSON.
- `supabase-js` from a CDN is fine on GitHub Pages (no CSP).
- Small league scale → direct browser reads are fine (add caching only if needed).
- Local preview and CI: `buildSiteData` is pure and tested with fixtures; the
  Supabase fetch is a thin wrapper. Local browser preview reads live public data.

## Out of scope (this change)

- Any user **writes** (future phase; foundation laid here).
- Removing the now‑unused export step / `tournaments.json` (later cleanup).
- Non‑Google providers; self‑serve association (kept admin‑manual per spec).
