# Player Profile — design

## Goal

Make each player's name clickable — every League player on the **Leaderboard**
and every person in the **Tournament** view — opening a **Player Profile** page
that shows that player's statistics.

## Statistics

1. **Placements** — how many tournaments the player finished 1st / 2nd / 3rd.
2. **Decks** — decks the player has played, each with the number of tournaments
   played on it.
3. **Top 3 Rivals** — the opponents the player has *lost* to the most.
4. **Top 3 Friends** — the opponents the player has *played against* the most.

Plus a small summary: tournaments played and overall W–D–L.

## Data source

Everything is computed **client-side from `tournaments.json`** (already exported
and loaded by the app). No backend, schema, or export change.

- Placements and Decks work for **all** events.
- Rivals and Friends need per-match opponents, which only **round-based** events
  carry (legacy standings-only imports have no opponents). They are computed from
  the events that have round-by-round pairings; a clear empty state is shown when
  a player has none.

Players are identified by **name** (the anonymised display name), consistent with
how the leaderboard already aggregates.

## Routing (in `web/app.js`)

Static GitHub Pages has no server routing, so use a hash route.

- A name links to `#player/<encodeURIComponent(name)>`.
- A router runs on `load` and `hashchange`:
  - hash matches `#player/<name>` → hide the three tab sections, show a new
    `#view-profile` section, render the profile for the decoded name.
  - otherwise → hide `#view-profile`, show the currently-active tab section.
- The profile has a **← Back** link (`href="#"`) that returns to the active tab.
- Tab clicks clear the hash (so leaving a profile works) and set the active tab.

## Stats module (new `web/lib/player-stats.js`)

Pure `playerProfile(tournaments, name)` → `{ tournaments, record, placements,
decks, rivals, friends }`:

- **placements** `{ first, second, third }` — for each tournament the player
  attended, order all attendees with the shared `rankPlayers` (same order as the
  leaderboard, honouring official standings) and increment first/second/third when
  the player's index is 0/1/2.
- **decks** `[{ deck, tournaments }]` — the player's `player_deck` grouped by
  distinct tournament, sorted by count desc then name.
- **rivals** `[{ name, losses }]` (top 3) — walk each tournament's round pairings;
  when the player is in a pairing with an opponent (not a bye) and lost the match
  (their `game_wins` < the opponent's), increment losses for that opponent. Sort
  by losses desc then name; take 3.
- **friends** `[{ name, games }]` (top 3) — same walk, counting every match played
  against each opponent (win, loss, or draw). Sort by games desc then name; take 3.
- **record** `{ wins, draws, losses }` — the player's final record summed across
  tournaments; **tournaments** — count attended.

`rankPlayers` and `points` are imported from `web/lib/leaderboard.js` (already
exported). A player's per-tournament final record / summed game wins is reduced
the same way `finalStandings` does in the tournament view.

## Clickable names (new `web/ui/player-link.js`)

`playerLink(name, extraClass?)` → `<a class="player-link …" href="#player/<enc>">name</a>`.

- **Leaderboard** (`leaderboard-view.js`): wrap the player name.
- **Tournament** (`tournament-view.js`): wrap the name in the standings table and
  both sides of every pairing, including the bye player. Non-league people are
  clickable too.

## Profile view (new `web/ui/profile-view.js`)

`renderProfile(name, profile)` returns:

- Header: player name + summary line (`N tournaments · W–D–L`).
- **Placements**: a row of 🥇/🥈/🥉 with counts.
- **Decks**: list of `deck — N tournaments`; empty state "No decks recorded yet".
- **Top 3 Rivals**: list of `name — N losses`; empty state
  "No head-to-head data yet".
- **Top 3 Friends**: list of `name — N games`; empty state
  "No head-to-head data yet".
- Unknown player (no data) → a friendly "No data for this player" message.

## Styling (`web/styles.css`)

- `.player-link` — inherits colour, subtle underline on hover; keeps the row
  layout (does not break the `.pname` ellipsis or `.name` in pairings).
- `.profile-*` — header, the placements row, and the stat lists (reusing the
  card/`--surface` look already used by rank cards / rules).

## Testing

- `player-stats.js`: placements (incl. a top-3 finish and a non-top-3),
  deck grouping across tournaments, rivals ordered by losses, friends by games,
  empty head-to-head, unknown player.
- `profile-view.js`: renders each section and the empty states.
- `player-link.js`: href encodes the name; text is the name.
- `node --test tests/web/*.test.mjs` stays green.
- Browser: clicking a name routes to the profile; Back returns; names in both
  views are links; deep-link `#player/<name>` renders on load.

## Out of scope

- Any backend/schema/export/Discord change.
- Server-side routing, per-player pages pre-rendered at build time.
- Historical charts / per-round timelines.
