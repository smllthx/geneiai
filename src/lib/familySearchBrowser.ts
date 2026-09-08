import { supabase } from '@/integrations/supabase/client';

// Open synchronously from the click, before awaiting the authorization URL.
// OAuth uses a top-level window, never an iframe that breaks provider sign-in.
export async function authorizeFamilySearch() {
  const popup = window.open('about:blank', 'geneai-familysearch', 'popup,width=720,height=800');
  try {
    const { data, error } = await supabase.functions.invoke('familysearch-auth', {
      body: { action: 'start', redirect_uri: `${window.location.origin}/familysearch/callback` },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const url = new URL(data?.url);
    if (url.protocol !== 'https:' || !['ident.familysearch.org', 'identbeta.familysearch.org'].includes(url.hostname)) throw new Error('La dirección de autorización no es válida.');
    if (popup && !popup.closed) { popup.location.replace(url.href); popup.focus(); }
    else window.location.assign(url.href);
  } catch (error) { popup?.close(); throw error; }
}
