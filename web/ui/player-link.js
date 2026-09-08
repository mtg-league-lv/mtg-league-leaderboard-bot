// A link to a player's profile (hash route). `name` is both the visible text and
// the route key, consistent with how the leaderboard aggregates by name.
export function playerLink(name, extraClass = '') {
  const cls = extraClass ? `player-link ${extraClass}` : 'player-link';
  return `<a class="${cls}" href="#player/${encodeURIComponent(name)}">${name}</a>`;
}
