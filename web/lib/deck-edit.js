// Thin wrapper over the set-deck Edge Function. Browser-only I/O; the function
// enforces ownership + the 7-day window server-side.
export async function saveDeck(client, { tournamentId, deckName, deckColours }) {
  const { data, error } = await client.functions.invoke('set-deck', {
    body: { tournament_id: tournamentId, deck_name: deckName, deck_colours: deckColours },
  });
  if (error) throw error;
  return data; // { deck, deck_colours }
}
