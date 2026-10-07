import { supabase } from '@/integrations/supabase/client';

/** Save with the caller's session/RLS; zero updated rows must be reported as a failure. */
export async function savePersonPortrait(personId: string, url: string, photoId?: string) {
  if (!personId || !url) throw new Error('Falta la persona o la foto del retrato.');
  if (photoId) {
    const { data, error } = await supabase.from('fotos').select('personas_ids').eq('id', photoId).single();
    if (error) throw error;
    const ids = [...new Set([...(data.personas_ids ?? []), personId])];
    const result = await supabase.from('fotos').update({ personas_ids: ids }).eq('id', photoId).select('id').single();
    if (result.error) throw result.error;
  }
  const { error } = await supabase.from('personas').update({ foto_url: url }).eq('id', personId).select('id').single();
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('genaia:data-changed', { detail: { table: 'personas', personId, foto_url: url } }));
  if (photoId) window.dispatchEvent(new CustomEvent('genaia:data-changed', { detail: { table: 'fotos', photoId } }));
}
