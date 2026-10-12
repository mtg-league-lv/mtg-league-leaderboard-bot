# Personal notes on the Account page — design

## Goal

On the Account page, a signed-in user who is linked to a player can keep a free
-text **"Personal notes"** area (e.g. League Credit, cards lent/borrowed). It
appears after "Top friends" in the embedded profile, is editable and saved to
Supabase, and is sanitized on save and on render to prevent injection.

## Requirements

1. Show a "Personal notes" section after Top friends — only for a signed-in,
   admin-linked user viewing their own Account page. (Not on the public
   `#player/<name>` profile; not for unlinked users.)
2. Empty notes show the hint (placeholder): "You can track your League Credit and
   cards that you've lent/borrowed here".
3. The user can edit the text and Save it; it persists and reloads.
4. Input is sanitized on save and on load to avoid injection (XSS).

## Storage & security

- Add a `notes text` column to `profiles`.
- Writes go directly from the browser, gated by **Row Level Security**:
  - Own-row UPDATE policy: `for update to authenticated using (auth.uid() = id)
    with check (auth.uid() = id)`.
  - **Column-restricted grant:** `revoke update on profiles from authenticated;
    grant update (notes) on profiles to authenticated;` — so a user can write
    only their own `notes`, and specifically **not** `player_key` (no self
    -linking). `service_role` (admin) is unaffected; SELECT own-row is unchanged.

## Sanitization (both directions)

- **On render (load):** pure `escapeHtml(text)` escapes `& < > " '` when the
  saved text is injected between `<textarea>…</textarea>`. This is the real XSS
  defense — it prevents breaking out of the textarea (e.g. a stored
  `</textarea><script>` renders inert).
- **On save:** pure `sanitizeNotes(text)` strips control characters (except tab
  / newline / carriage return), trims, and caps at 2000 chars. The raw (not
  pre-escaped) sanitized text is stored, so render-time escaping never double
  -encodes.
- Notes are only ever shown to their owner, so the exposure is self-XSS, but the
  output-encoding handles it correctly regardless.

## Components / boundaries

- `web/lib/notes.js` — pure `sanitizeNotes(text)` + `escapeHtml(text)` (unit-tested).
- `web/ui/notes-view.js` — pure `renderPersonalNotes(notes)`: an `<h2
  class="profile-section">Personal notes</h2>`, a `<textarea id="notes-text">`
  (hint placeholder, `maxlength=2000`, escaped content), a Save button
  (`#notes-save`) and a status span (`#notes-status`).
- `web/lib/notes-data.js` — thin `loadNotes(client)` (reads own `profiles.notes`)
  and `saveNotes(client, userId, text)` (updates own row).
- `web/ui/account-view.js` — when `linked`, append `renderPersonalNotes(linked
  .notes)` inside `.account-profile`, after the embedded profile (so after Top
  friends). `linked` gains a `notes` field.
- `web/app.js` — `refreshViewer()` loads `state.notes` for the signed-in user;
  `linkedFor()` passes `notes`; a delegated `#notes-save` handler sanitizes,
  saves, updates `state.notes`, and shows "Saved".
- `web/styles.css` — `.personal-notes` / `.notes-input` styling.
- Migration applied to the live DB (and recorded in `supabase/schema.sql`).

## Testing

- Units (node): `escapeHtml` (escapes the five chars; empty/null → ''),
  `sanitizeNotes` (trim, 2000 cap, control-char strip, empty/null → ''),
  `renderPersonalNotes` (hint placeholder present; injected `</textarea><script>`
  is escaped; Save button present), `renderAccount` (notes section present when
  linked, after the profile; absent when not linked / signed out).
- Browser: a linked user types notes, saves, reloads → persists; entering a
  `<script>`/`</textarea>` payload is stored and rendered escaped (no execution).

## Risks / notes

- Changing the season re-renders the Account view, resetting the textarea to the
  last saved value; unsaved edits made without saving are lost (acceptable edge
  case — notes are season-independent).
- `loadNotes`/`saveNotes` are thin I/O; the security boundary is the RLS policy +
  column grant, not the client.

## Out of scope

- Rich text / Markdown rendering (plain text only).
- Notes for unlinked users or on the public profile page.
- Sharing notes between users.
