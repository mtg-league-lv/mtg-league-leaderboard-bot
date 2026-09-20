// Map the signed-in viewer's linked player_key to the display name used as the
// Leaderboard row identity. Pure: no auth, no network. `profile` is the viewer's
// own profiles row ({ player_key } | null); `players` is the raw players list.
export function associatedName(profile, players) {
  if (!profile || !profile.player_key) return null;
  const match = players.find(p => p.player_key === profile.player_key);
  return match ? match.display_name : null;
}
