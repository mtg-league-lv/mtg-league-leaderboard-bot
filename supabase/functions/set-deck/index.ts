// Sole writer for player deck info. Enforces ownership (player_key comes from
// the caller's profile, never the body) and the 7-day edit window server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeColours(input: unknown): string {
  if (!input) return '';
  const chars = Array.isArray(input) ? input : String(input).split('');
  const seen = new Set(chars.map((c) => String(c).toUpperCase()));
  return WUBRG.filter((c) => seen.has(c)).join('');
}

function withinWindow(eventDate: string, days: number): boolean {
  const deadline = new Date(`${eventDate}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return Date.now() < deadline.getTime();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their JWT.
  const authed = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await authed.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  // Service-role client for the profile lookup and the write (bypasses RLS).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: profile } = await admin
    .from('profiles').select('player_key').eq('id', user.id).maybeSingle();
  if (!profile || !profile.player_key) return json({ error: 'account not linked' }, 403);

  let body: { tournament_id?: unknown; deck_name?: unknown; deck_colours?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const tournamentId = body.tournament_id;
  if (!tournamentId) return json({ error: 'tournament_id required' }, 400);

  const { data: tourney } = await admin
    .from('tournaments').select('event_date').eq('id', tournamentId).maybeSingle();
  if (!tourney) return json({ error: 'tournament not found' }, 404);
  if (!withinWindow(tourney.event_date, 7)) return json({ error: 'edit window closed' }, 403);

  const colours = normalizeColours(body.deck_colours) || null;
  const name = (typeof body.deck_name === 'string' ? body.deck_name.trim().slice(0, 60) : '') || null;

  const { error } = await admin
    .from('round_results')
    .update({ player_deck: name, player_deck_colours: colours })
    .eq('tournament_id', tournamentId)
    .eq('player_key', profile.player_key);
  if (error) return json({ error: error.message }, 500);

  return json({ deck: name, deck_colours: colours });
});
