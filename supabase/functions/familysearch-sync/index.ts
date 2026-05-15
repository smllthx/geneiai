// Descarga el árbol del usuario desde FamilySearch (GEDCOM-X) y lo importa.
// POST /familysearch-sync con { generaciones_asc, generaciones_desc }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FS_API = "https://api.familysearch.org";

async function refreshIfNeeded(supabase: any, account: any) {
  if (!account.expires_at) return account.access_token;
  const expires = new Date(account.expires_at).getTime();
  if (expires - Date.now() > 60_000) return account.access_token;
  if (!account.refresh_token) return account.access_token;
  const clientId = Deno.env.get("FAMILYSEARCH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("FAMILYSEARCH_CLIENT_SECRET")!;
  const res = await fetch("https://ident.familysearch.org/cis-web/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh token: ${JSON.stringify(data)}`);
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await supabase.from("external_accounts").update({
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

function nameOf(person: any): { nombres: string; apellidos: string } {
  const n = person?.names?.[0]?.nameForms?.[0];
  const full = n?.fullText ?? "";
  const parts = n?.parts ?? [];
  const given = parts.find((p: any) => p.type?.endsWith("/Given"))?.value;
  const surname = parts.find((p: any) => p.type?.endsWith("/Surname"))?.value;
  if (given || surname) return { nombres: given ?? "(sin nombre)", apellidos: surname ?? "(sin apellido)" };
  if (full) {
    const split = full.trim().split(/\s+/);
    if (split.length === 1) return { nombres: split[0], apellidos: "(sin apellido)" };
    return { nombres: split.slice(0, -1).join(" "), apellidos: split[split.length - 1] };
  }
  return { nombres: "(sin nombre)", apellidos: "(sin apellido)" };
}

function dateOf(person: any, factType: string): string | null {
  const fact = person?.facts?.find((f: any) => f.type?.endsWith(factType));
  const formal = fact?.date?.formal;
  if (!formal) return null;
  const m = formal.match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2] ?? "01"}-${m[3] ?? "01"}`;
}

function placeOf(person: any, factType: string): string | null {
  const fact = person?.facts?.find((f: any) => f.type?.endsWith(factType));
  return fact?.place?.original ?? null;
}

function sexOf(person: any): "M" | "F" | null {
  const t = person?.gender?.type;
  if (t?.endsWith("/Male")) return "M";
  if (t?.endsWith("/Female")) return "F";
  return null;
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

    const { generaciones_asc = 4, generaciones_desc = 2 } = await req.json().catch(() => ({}));

    const { data: account, error: aErr } = await supabase
      .from("external_accounts").select("*")
      .eq("user_id", user.id).eq("provider", "familysearch").maybeSingle();
    if (aErr) throw aErr;
    if (!account) throw new Error("FamilySearch no conectado");

    const token = await refreshIfNeeded(supabase, account);

    // Quién soy en FS
    const meRes = await fsGet(token, "/platform/users/current");
    const meId = meRes?.users?.[0]?.personId;
    if (!meId) throw new Error("No se pudo obtener tu persona en FamilySearch");

    // Ascendencia
    const ancestry = await fsGet(token, `/platform/tree/ancestry?person=${meId}&generations=${Math.min(generaciones_asc, 8)}`);
    const persons: any[] = ancestry?.persons ?? [];
    const relationships: any[] = ancestry?.relationships ?? [];

    // Descendencia opcional
    if (generaciones_desc > 0) {
      try {
        const desc = await fsGet(token, `/platform/tree/descendancy?person=${meId}&generations=${Math.min(generaciones_desc, 2)}`);
        for (const p of desc?.persons ?? []) if (!persons.find((x) => x.id === p.id)) persons.push(p);
        for (const r of desc?.relationships ?? []) relationships.push(r);
      } catch (_) { /* opcional */ }
    }

    // Dedupe contra existentes (por fs_id)
    const fsIds = persons.map((p) => p.id);
    const { data: existing } = await supabase
      .from("personas").select("id, ids_externos")
      .eq("user_id", user.id);
    const existingByFs = new Map<string, string>();
    for (const e of existing ?? []) {
      const fsId = (e.ids_externos as any)?.familysearch_id;
      if (fsId) existingByFs.set(fsId, e.id);
    }

    const fsToLocal = new Map<string, string>();
    let creadas = 0;

    for (const p of persons) {
      if (existingByFs.has(p.id)) {
        fsToLocal.set(p.id, existingByFs.get(p.id)!);
        continue;
      }
      const { nombres, apellidos } = nameOf(p);
      const sex = sexOf(p);
      const row = {
        user_id: user.id,
        nombres, apellidos,
        sexo: sex === "M" ? "masculino" : sex === "F" ? "femenino" : null,
        nac_fecha: dateOf(p, "/Birth"),
        defuncion_fecha: dateOf(p, "/Death"),
        bautismo_fecha: dateOf(p, "/Christening") ?? dateOf(p, "/Baptism"),
        viva: p.living ? "si" : "desconocido",
        certeza: "probable" as const,
        ids_externos: { familysearch_id: p.id, import_source: "FamilySearch" },
        notas: [
          placeOf(p, "/Birth") ? `Nac. en ${placeOf(p, "/Birth")}` : null,
          placeOf(p, "/Death") ? `Def. en ${placeOf(p, "/Death")}` : null,
        ].filter(Boolean).join(" · ") || null,
      };
      const { data: ins, error } = await supabase.from("personas").insert(row).select("id").single();
      if (error) continue;
      fsToLocal.set(p.id, ins.id);
      creadas++;
    }

    // Relaciones (Couple, ParentChild)
    let relsCreadas = 0;
    for (const r of relationships) {
      const t = r.type;
      const aFs = r.person1?.resourceId ?? r.person1?.resource?.replace(/^#/, "");
      const bFs = r.person2?.resourceId ?? r.person2?.resource?.replace(/^#/, "");
      const aId = fsToLocal.get(aFs);
      const bId = fsToLocal.get(bFs);
      if (!aId || !bId) continue;

      if (t?.endsWith("/Couple")) {
        await supabase.from("relaciones").insert([
          { user_id: user.id, persona_id: aId, pariente_id: bId, tipo: "conyuge", naturaleza: "biologica", certeza: "probable" },
          { user_id: user.id, persona_id: bId, pariente_id: aId, tipo: "conyuge", naturaleza: "biologica", certeza: "probable" },
        ]);
        relsCreadas += 2;
      } else if (t?.endsWith("/ParentChild")) {
        // a = padre/madre, b = hijo
        const parent = persons.find((p) => p.id === aFs);
        const tipoPadre = sexOf(parent) === "F" ? "madre" : "padre";
        await supabase.from("relaciones").insert([
          { user_id: user.id, persona_id: bId, pariente_id: aId, tipo: tipoPadre, naturaleza: "biologica", certeza: "probable" },
          { user_id: user.id, persona_id: aId, pariente_id: bId, tipo: "hijo", naturaleza: "biologica", certeza: "probable" },
        ]);
        relsCreadas += 2;
      }
    }

    await supabase.from("actividad").insert({
      user_id: user.id, tipo: "import",
      descripcion: `Sincronización FamilySearch: ${creadas} personas, ${relsCreadas} relaciones`,
      metadata: { source: "familysearch", creadas, relsCreadas },
    });

    return new Response(JSON.stringify({ creadas, relsCreadas, total: persons.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
