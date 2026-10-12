// Thin I/O for personal notes over the viewer's own profiles row. The security
// boundary is the RLS own-row update policy + column grant, not this wrapper.
export async function loadNotes(client) {
  const { data, error } = await client.from('profiles').select('notes').maybeSingle();
  if (error) return '';
  return (data && data.notes) ? data.notes : '';
}

export async function saveNotes(client, userId, notes) {
  const { error } = await client.from('profiles').update({ notes }).eq('id', userId);
  if (error) throw error;
}
