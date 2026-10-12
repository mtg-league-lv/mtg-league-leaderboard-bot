// Pure helpers for personal notes.

// Escape HTML so stored text is inert when injected into the DOM — the real XSS
// defense (output encoding). Used wherever notes are rendered.
export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MAX_NOTES = 2000;
// Strip control characters except tab (09), newline (0A) and carriage return (0D).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Sanitize on save: strip control chars, trim, cap length. Stores raw text (not
// pre-escaped) so render-time escaping never double-encodes.
export function sanitizeNotes(text) {
  if (!text) return '';
  return String(text).replace(CONTROL_CHARS, '').trim().slice(0, MAX_NOTES);
}
