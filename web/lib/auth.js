// Thin browser-only wrapper over supabase.auth + the viewer's own profiles row.
// Pure rendering/mapping lives in association.js and the *-view.js modules.

function toUser(u) {
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: m.full_name || m.name || u.email || 'Player',
    avatarUrl: m.avatar_url || m.picture || null,
  };
}

export async function currentUser(client) {
  const { data } = await client.auth.getUser();
  return data.user ? toUser(data.user) : null;
}

export function onUserChange(client, cb) {
  return client.auth.onAuthStateChange((_event, session) => {
    cb(session && session.user ? toUser(session.user) : null);
  });
}

export function signInWithGoogle(client, redirectTo) {
  return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

export function signOut(client) {
  return client.auth.signOut();
}

export async function associatedPlayerKey(client) {
  // RLS returns only the caller's own row; null when unlinked or signed out.
  const { data, error } = await client.from('profiles').select('player_key').maybeSingle();
  if (error) return null;
  return data ? data.player_key : null;
}
