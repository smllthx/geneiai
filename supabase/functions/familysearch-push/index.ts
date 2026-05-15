// Sube a FamilySearch las personas marcadas con sync_to_fs=true que aún no tienen fs_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FS_API = "https://api.familysearch.org";

async function refreshIfNeeded(supabase: any, account: any) {
  if (!account.expires_at) return account.access_token;
  if (new Date(account.expires_at).getTime() - Date.now() > 60_000) return account.access_token;
  if (!account.refresh_token) return account.access_token;
  const res = await fetch("https://ident.familysearch.org/cis-web/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: Deno.env.get("FAMILYSEARCH_CLIENT_ID")!,
      client_secret: Deno.env.get("FAMILYSEARCH_CLIENT_SECRET")!,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh: ${JSON.stringify(data)}`);
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await supabase.from("external_accounts").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? account.refresh_token,
    expires_at: expiresAt,
  }).eq("id", account.id);
  return data.access_token;
}

function buildPersonPayload(p: any) {
  const parts: any[] = [];
  if (p.nombres) parts.push({ type: "http://gedcomx.org/Given", value: p.nombres });
  if (p.apellidos) parts.push({ type: "http://gedcomx.org/Surname", value: p.apellidos });
  const facts: any[] = [];
  if (p.nac_fecha) facts.push({ type: "http://gedcomx.org/Birth", date: { original: p.nac_fecha } });
  if (p.defuncion_fecha) facts.push({ type: "http://gedcomx.org/Death", date: { original: p.defuncion_fecha } });
  return {
    persons: [{
      living: p.viva === "si",
      gender: p.sexo === "masculino" ? { type: "http://gedcomx.org/Male" }
            : p.sexo === "femenino" ? { type: "http://gedcomx.org/Female" } : undefined,
      names: [{ nameForms: [{ fullText: `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim(), parts }] }],
      facts,
    }],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { data: account } = await supabase.from("external_accounts").select("*")
      .eq("user_id", user.id).eq("provider", "familysearch").maybeSingle();
    if (!account) throw new Error("FamilySearch no conectado");
    const token = await refreshIfNeeded(supabase, account);

    const { data: personas } = await supabase.from("personas").select("*")
      .eq("sync_to_fs", true);
    const pending = (personas ?? []).filter((p: any) => !p.ids_externos?.familysearch_id);

    let subidas = 0;
    const errores: string[] = [];
    for (const p of pending) {
      try {
        const res = await fetch(`${FS_API}/platform/tree/persons`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-gedcomx-v1+json",
            Accept: "application/x-gedcomx-v1+json",
          },
          body: JSON.stringify(buildPersonPayload(p)),
        });
        if (!res.ok) {
          errores.push(`${p.nombres} ${p.apellidos}: ${res.status}`);
          await res.text();
          continue;
        }
        const loc = res.headers.get("location") || "";
        const fsId = loc.split("/").pop()?.split("?")[0];
        if (fsId) {
          await supabase.from("personas").update({
            ids_externos: { ...(p.ids_externos ?? {}), familysearch_id: fsId },
          }).eq("id", p.id);
        }
        subidas++;
      } catch (e: any) {
        errores.push(`${p.nombres}: ${e.message}`);
      }
    }

    await supabase.from("actividad").insert({
      user_id: user.id, tipo: "export",
      descripcion: `Push a FamilySearch: ${subidas} personas subidas`,
      metadata: { source: "familysearch-push", subidas, errores },
    });

    return new Response(JSON.stringify({ subidas, total: pending.length, errores }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
