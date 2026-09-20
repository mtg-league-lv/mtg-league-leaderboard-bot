# Player deck self-edit ("You've played") — design

## Goal

In the **Tournament** view, a logged-in player who is admin-linked to a
participant of the shown tournament sees a **"You've played"** section directly
above "Final standings", showing their deck colors and deck name. While the
event is **less than 7 days old**, the section is an editable form (mana-pip
color toggles + deck-name field + Save); at 7 days or older it is read-only.
This is the league's **first write path** — writes go through a single Supabase
**Edge Function** that enforces ownership and the 7-day window server-side.

## Requirements

1. Show "You've played" only when the viewer is **logged in**, **linked** to a
   player (via `profiles`), and that player **participated** in the tournament
   currently displayed. Otherwise render nothing new (anonymous view unchanged).
2. The section shows the linked player's deck colors (mana pips) and deck name
   for that tournament.
3. When the event is `< 7 days` old, allow editing both fields (even if already
   set); colors are chosen via clickable W/U/B/R/G pip toggles.
4. Editing at `>= 7 days` is not allowed (read-only, or "No deck recorded yet"
   when blank).

## Non-negotiables

- **Ownership is server-enforced.** The player_key written is derived from the
  authenticated caller's `profiles` row on the server — never taken from the
  request body. A user can only ever edit their own decks.
- **The 7-day window is server-enforced**, independent of the UI, from
  `tournaments.event_date`.
- Public reads and the anonymous experience are unchanged. `round_results` has
  **no** user write policy; the Edge Function (service_role) is the only writer.

## Architecture

### Edge Function `set-deck` (the only writer)

Deployed to Supabase (Deno/TypeScript). The browser calls it via
`supabase.functions.invoke('set-deck', { body })`; supabase-js attaches the
user's access token. Steps:

1. Handle CORS preflight (`OPTIONS`) and set CORS headers on every response.
2. Read the caller from the JWT (an anon client created with the request's
   `Authorization` header → `auth.getUser()`). No user → **401**.
3. Look up the caller's `profiles` row → `player_key`. Missing → **403**
   ("account not linked"). **This is the ownership guarantee.**
4. Read `tournaments.event_date` for the body's `tournament_id`. If the row is
   missing → **404**. If `now >= event_date + 7 days` → **403** ("edit window
   closed"). Boundary: editable while `now < event_date + 7 days` (day 6 yes,
   day 7 no), computed at UTC midnight of `event_date`.
5. Validate input: `deck_colours` reduced to the WUBRG subset, de-duplicated,
   canonical order (may be empty); `deck_name` trimmed, capped at 60 chars (may
   be empty → stored as null).
6. With a **service_role** client, `update round_results set player_deck = $name,
   player_deck_colours = $colours where tournament_id = $tid and player_key =
   <caller's key>` (all their rows in that event). Return `{ deck, deck_colours }`.

Errors return a JSON `{ error }` with the status above.

### Frontend

- `web/ui/tournament-view.js`
  - Pure `renderYouvePlayed(entry, editable)` → the section HTML. `entry` =
    `{ name, deck, deck_colours }` (the linked player's aggregated tournament
    deck). `editable` true → pip toggles (pre-selected from `deck_colours`) +
    name input + Save button; false → read-only display, or "No deck recorded
    yet" when both blank.
  - `renderTournament(tournament, viewer)` — `viewer` is
    `{ name, editable } | null`. When `viewer` is set and `viewer.name`
    participated, prepend the section above "Final standings". `viewer` omitted
    → current behavior (used by existing tests).
- `web/lib/deck.js` (pure, unit-tested)
  - `normalizeColours(letters)` — from a string/array of selected letters,
    return the canonical WUBRG-ordered, de-duplicated subset string.
  - `isWithinDays(eventDate, now, days)` — true while `now < eventDate + days`
    (UTC-midnight based). Drives the editable gate on the client; the function
    enforces the same rule server-side.
- `web/lib/deck-edit.js` — thin `saveDeck(client, { tournamentId, deckName,
  deckColours })` wrapping `client.functions.invoke('set-deck', …)`; returns the
  saved values or throws on error.
- `web/app.js` (Tournament wiring)
  - Compute `viewer` from `state.user`, `state.associatedName`, and each
    tournament's `event_date` (`isWithinDays(date, new Date(), 7)`).
  - Pass `viewer` into `renderTournament`.
  - Delegate clicks in the Tournament body: toggle pips (visual state), and on
    **Save** call `saveDeck(...)`, then re-run `loadSiteData(client)` and
    re-render Tournament + Leaderboard so the new deck shows everywhere.

The linked player's tournament deck is taken from the already-computed
`finalStandings` entry (deck is uniform across a player's rows in an event).

## Components / boundaries

- `supabase/functions/set-deck/index.ts` — the Edge Function (sole writer).
- `web/lib/deck.js` — pure `normalizeColours`, `isWithinDays` (unit-tested).
- `web/lib/deck-edit.js` — thin invoke wrapper (browser I/O).
- `web/ui/tournament-view.js` — `renderYouvePlayed` + `renderTournament(viewer)`.
- `web/app.js` — Tournament viewer wiring + save/refresh.

## Testing

- **Unit (node):** `normalizeColours` (order/dedup/invalid stripped/empty);
  `isWithinDays` (day 6 true, day 7 false, future); `renderYouvePlayed`
  (editable form pre-selected, read-only with value, empty read-only). Existing
  tournament-view tests still pass (viewer defaults to none).
- **Browser:** linked participant < 7 days sees the pre-filled form, saves,
  value persists after refresh and appears in standings; >= 7 days read-only;
  unlinked/anonymous/non-participant see nothing.
- **Function security (manual):** a forged `player_key` in the body is ignored
  (server uses the profile key); an out-of-window edit returns 403; an unlinked
  user returns 403.

## Risks / notes

- **CORS:** the function sets permissive CORS headers (allow the site origin,
  `authorization, content-type`) and answers `OPTIONS`. This is the first custom
  endpoint, so CORS matters here (built-in PostgREST reads did not).
- **Client/server rule duplication:** `isWithinDays` runs on the client for the
  gate and is mirrored in the function; the function is the source of truth.
- **Refresh cost:** re-fetching all data after a save is simple and safe at this
  league's scale; optimize only if needed.

## Out of scope

- Editing anything other than the linked player's own deck name/colors.
- Admin editing via the app (admins continue to use the dashboard).
- Self-serve association (still admin-manual, unchanged).
