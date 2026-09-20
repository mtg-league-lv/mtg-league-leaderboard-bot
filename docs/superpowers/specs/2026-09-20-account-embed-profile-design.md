# Embed Player Profile in the Account page — design

## Goal

When a signed-in user is admin-linked to a player, the Account page shows that
player's **full Player Profile inline** (placements, colors, decks, rivals,
friends, with the interactive season selector) instead of a "Linked to …" link.

## Requirements

1. Linked viewer → account header (name / email / avatar + Sign out) followed by
   the embedded Player Profile (same content as the `#player/<name>` page).
2. The embedded profile keeps its interactive season selector; changing it
   re-renders only the profile portion within the Account page.
3. No extra "Your player" label — the profile's own player-name heading suffices.
4. Not-linked and signed-out states are unchanged. The standalone
   `#player/<name>` route and player links elsewhere are unchanged.

## Design

- `web/ui/profile-view.js`: `renderProfile(name, profile, seasons,
  selectedSeason, options = {})` gains `options.showBack` (default `true`). When
  `false`, the leading "← Back" link is omitted so the profile can be embedded
  without a duplicate back link (the Account page provides its own).
- `web/ui/account-view.js`: `renderAccount(user, linked)` where `linked` is
  `{ name, profile, seasons, selectedSeason } | null`.
  - `user` null → signed-out prompt (unchanged).
  - linked null → "Not linked yet — ask an admin" (unchanged copy).
  - linked set → account header, then `renderProfile(linked.name, linked.profile,
    linked.seasons, linked.selectedSeason, { showBack: false })` inside a
    `.account-profile` wrapper. Sign out button remains.
- `web/app.js` `showAccount()`:
  - Build `linked` from `state.associatedName`: `playerProfile(tournaments,
    name)` + the player's seasons (same `seasonsForPlayer` logic used for the
    profile route), `selectedSeason` defaulting to `'all'`.
  - Delegate `change` on the account view: when `#profile-season` changes,
    recompute `playerProfile` for the chosen season and re-render the embedded
    profile in place (mirroring the existing profile-route handler).
- `web/styles.css`: a light divider above the embedded profile
  (`.account-profile`).

## Testing

- Unit (node): `renderProfile(..., { showBack: false })` omits the back link;
  `renderAccount(user, linked)` renders the embedded profile (placements/decks)
  when linked, the not-linked message when `linked` is null, and the sign-in
  prompt when `user` is null.
- Browser: a linked user's Account page shows the embedded profile with a working
  season selector; not-linked/anonymous unchanged.

## Out of scope

- Editing profile data from the Account page.
- Changing the standalone profile route or leaderboard/tournament player links.
