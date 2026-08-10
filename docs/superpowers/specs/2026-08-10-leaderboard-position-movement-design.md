# Leaderboard position movement — design

## Goal

On the **Leaderboard** tab, next to each player, show how their standing moved
compared to the season board *before the most recent tournament*. A new column
after `Pts/Event` shows a green up-arrow, a red down-arrow, `NEW`, or nothing.

## Comparison basis

The leaderboard is a **season-aggregate** ranking (sum of scores across all
tournaments in the selected season). Movement compares two boards:

- **Current board** — all tournaments in the selected season.
- **Previous board** — the same season **excluding the latest-dated
  tournament(s)** (exclude every tournament whose date equals the season's max
  date, so same-day events are handled together).

Positions on **both** boards are assigned using the **currently-applied sort**
(column + direction). Sorting by a different column re-ranks both boards and
recomputes the arrows, so movement always matches the visible `#` order.

`delta = previousPosition − currentPosition` (positive ⇒ moved up the list).

## Movement cell

| Case | Render | Colour |
|------|--------|--------|
| Moved up `n` | `▲ **n**` | green (`--win`) |
| Moved down `n` | `▼ **n**` | red (`--down`, new var) |
| No change (`delta == 0`) | empty cell | — |
| On current board, absent from previous board | `NEW` (bold) | green (`--win`) |
| Season has **no** prior tournament (previous board empty) | empty cell for every row | — |

`n` is the absolute delta, rendered bold. Arrows reuse the `▲`/`▼` glyphs already
used by the sort headers.

## Architecture

Keep the movement math pure and testable; keep the DOM wiring in `app.js`.

- **`web/lib/leaderboard.js`** — add `seasonLeaderboardBefore(tournaments, key)`
  returning `{ rows, hasPrevious }`:
  - `rows` — the season board computed over the season's tournaments minus the
    max-date tournament(s), same row shape as `seasonLeaderboard`.
  - `hasPrevious` — `true` iff at least one tournament in the season predates the
    max date (i.e. a previous board actually exists).
  - Reuses the existing per-tournament scoring so the two boards stay consistent.

- **`web/ui/leaderboard-view.js`** — add pure
  `computeMovements(currentSorted, previousSorted, hasPrevious)` →
  `Map<name, {type:'up'|'down'|'same'|'new', by:number}>`:
  - `hasPrevious === false` ⇒ empty map (all cells blank).
  - name not in `previousSorted` ⇒ `{type:'new'}`.
  - else `delta = prevPos − curPos`; `type` is `up`/`down`/`same`, `by = |delta|`.

  `renderLeaderboard(rows, sort, moves)` gains the `±` cell. `moves` defaults to
  an empty map, so existing callers/tests (which pass no movement data) render
  blank movement cells and keep passing.

- **`web/app.js`** — in `render()`:
  1. `current = seasonLeaderboard(...)`; `{rows: previous, hasPrevious} = seasonLeaderboardBefore(...)`.
  2. `currentSorted = sortLeaderboard(current, sort)` (unchanged — still what is rendered).
  3. `previousSorted = sortLeaderboard(previous, sort)`.
  4. `moves = computeMovements(currentSorted, previousSorted, hasPrevious)`.
  5. `renderLeaderboard(currentSorted, sort, moves)`.

  The header sort-click handler already calls `render()`, so arrows recompute on
  re-sort with no extra wiring.

## Styling

- Add `--down` red to `:root` and the dark `@media` block (mirrors `--win`).
- `.row` grid goes from 5 to 6 columns; tighten the numeric column widths and let
  the player-name column keep flexing (same wrap behaviour as today). Verify at
  the default (~540) and a mobile (375) width.
- New header cell `±` is a plain (non-sortable) header; movement cells reuse the
  `.num` right-alignment.

## Edge cases

- **Single-tournament season** → `hasPrevious=false` → column entirely blank.
- **Ascending sort** → "up" means higher in the list (matches the `#` column),
  not "better score". Consistent by construction.
- **Player dropped from the board** (was on previous, not on current) → no row, so
  nothing to show.
- **Ties** → resolved by `sortLeaderboard`'s stable name tiebreak, so both boards'
  positions are deterministic.

## Out of scope

- Sorting by the movement column.
- Persisting/animating movement; it is recomputed from data on each render.
- Any backend, schema, Discord, or export change (website-only).

## Testing

- `computeMovements`: up/down/same deltas, `NEW` for debut, empty map when
  `hasPrevious` is false, position from the *sorted* inputs.
- `seasonLeaderboardBefore`: excludes max-date tournament(s); `hasPrevious` false
  for a single-tournament season, true otherwise; row scores match the reduced set.
- `renderLeaderboard`: renders `▲`/`▼` + bold number, `NEW`, blank cell; blank for
  all when `moves` is empty.
- Full `node --test tests/web/*.test.mjs` stays green.
