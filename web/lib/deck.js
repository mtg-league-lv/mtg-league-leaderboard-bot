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
