// Cron-friendly: itera todos los usuarios con auto_sync activado y dispara la sincronización
// con FamilySearch usando sus refresh tokens. Pensado para ser llamado por pg_cron.
// verify_jwt = false; se autentica con CRON_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FS_API = "https://api.familysearch.org";

async function refreshToken(account: any, admin: any) {
  if (account.expires_at && new Date(account.expires_at).getTime() - Date.now() > 60_000) return account.access_token;
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
  if (!res.ok) throw new Error(`refresh: ${JSON.stringify(data)}`);
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("external_accounts").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? account.refresh_token,
    expires_at: expiresAt,
  }).eq("id", account.id);
  return data.access_token;
}

async function fsGet(token: string, path: string) {
  const res = await fetch(`${FS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/x-gedcomx-v1+json" },
  });
  if (!res.ok) throw new Error(`FS ${path}: ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: accounts } = await admin.from("external_accounts").select("*")
      .eq("provider", "familysearch");
    const optedIn = (accounts ?? []).filter((a: any) => a.metadata?.auto_sync === true);

    const results: any[] = [];
    for (const account of optedIn) {
      try {
        const token = await refreshToken(account, admin);
        const me = await fsGet(token, "/platform/users/current");
        const meId = me?.users?.[0]?.personId;
        if (!meId) { results.push({ user: account.user_id, error: "no FS person" }); continue; }
        const tree = await fsGet(token, `/platform/tree/ancestry?person=${meId}&generations=4`);
        const persons = tree?.persons ?? [];
        let creadas = 0;
        const { data: existing } = await admin.from("personas").select("id, ids_externos").eq("user_id", account.user_id);
        const existingFs = new Set<string>();
        for (const e of existing ?? []) {
          const fsId = (e.ids_externos as any)?.familysearch_id;
          if (fsId) existingFs.add(fsId);
        }
        for (const p of persons) {
          if (existingFs.has(p.id)) continue;
          const n = p?.names?.[0]?.nameForms?.[0];
          const parts = n?.parts ?? [];
          const given = parts.find((x: any) => x.type?.endsWith("/Given"))?.value ?? "(sin nombre)";
          const surname = parts.find((x: any) => x.type?.endsWith("/Surname"))?.value ?? "(sin apellido)";
          const birth = p?.facts?.find((f: any) => f.type?.endsWith("/Birth"))?.date?.formal;
          await admin.from("personas").insert({
            user_id: account.user_id,
            nombres: given, apellidos: surname,
            nac_fecha: birth ? birth.match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)?.[0]?.padEnd(10, "-01") ?? null : null,
            certeza: "probable",
            ids_externos: { familysearch_id: p.id, import_source: "FamilySearch (auto)" },
          });
          creadas++;
        }
        await admin.from("actividad").insert({
          user_id: account.user_id, tipo: "import",
          descripcion: `Sync automática FamilySearch: ${creadas} personas nuevas`,
          metadata: { source: "cron", creadas },
        });
        results.push({ user: account.user_id, creadas });
      } catch (e: any) {
        results.push({ user: account.user_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ procesados: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
