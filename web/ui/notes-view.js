import { escapeHtml } from '../lib/notes.js';

const HINT = "You can track your League Credit and cards that you've lent/borrowed here";

// Personal notes section (pure). `notes` is the saved text; escaped into the
// textarea so stored markup can never break out. Wiring lives in app.js.
export function renderPersonalNotes(notes) {
  return (
    '<h2 class="profile-section">Personal notes</h2>' +
    '<div class="personal-notes">' +
    '<textarea id="notes-text" class="notes-input" rows="4" maxlength="2000" ' +
    `placeholder="${escapeHtml(HINT)}">${escapeHtml(notes || '')}</textarea>` +
    '<div class="notes-actions">' +
    '<button id="notes-save" class="auth-signin" type="button">Save notes</button>' +
    '<span id="notes-status" class="deck-status" role="status"></span>' +
    '</div></div>'
  );
}
