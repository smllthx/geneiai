import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const envName = (Deno.env.get("FAMILYSEARCH_ENV") ?? "production").toLowerCase();
const isBeta = ["sandbox", "beta", "integration", "integ"].includes(envName);
const FS_API = isBeta ? "https://apibeta.familysearch.org" : "https://api.familysearch.org";
const IDENT = isBeta ? "https://identbeta.familysearch.org" : "https://ident.familysearch.org";
const GEDCOMX = "application/x-gedcomx-v1+json";

type AnyObject = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function refreshIfNeeded(supabase: any, account: AnyObject) {
  const expires = account.expires_at ? new Date(account.expires_at).getTime() : Number.POSITIVE_INFINITY;
  if (account.access_token && expires - Date.now() > 90_000) return account.access_token as string;
  if (!account.refresh_token) throw new Error("La sesión de FamilySearch expiró. Vuelve a autorizar FamilySearch antes de importar.");

  const clientId = Deno.env.get("FAMILYSEARCH_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("FAMILYSEARCH_CLIENT_SECRET") ?? "";
  if (!clientId) throw new Error("FamilySearch Client ID no configurado");

  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: clientId,
  };
  if (clientSecret) params.client_secret = clientSecret;

  const res = await fetch(`${IDENT}/cis-web/oauth2/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error("No fue posible renovar FamilySearch. Vuelve a autorizar la cuenta.");

  const expiresAt = new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString();
  const nextRefresh = data.refresh_token ?? account.refresh_token;
  const { error } = await supabase.from("external_accounts").update({
    access_token: data.access_token,
    refresh_token: nextRefresh,
    expires_at: expiresAt,
    scope: data.scope ?? account.scope ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", account.id);
  if (error) throw error;
  return data.access_token as string;
}

async function fsGet(token: string, path: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${FS_API}${path}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: GEDCOMX,
      "User-Agent": "GENAIA/1.0",
      ...extraHeaders,
    },
  });
  if (res.status === 401) throw new Error("FamilySearch rechazó la sesión. Vuelve a autorizar FamilySearch.");
  if (res.status === 429) throw new Error("FamilySearch limitó temporalmente las solicitudes. Intenta nuevamente más tarde.");
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`FamilySearch respondió ${res.status}: ${raw.slice(0, 220)}`);
  }
  return res.status === 204 ? {} : res.json();
}

function currentPersonId(payload: AnyObject) {
  if (payload?.persons?.[0]?.id) return payload.persons[0].id as string;
  const href = payload?.links?.person?.href ?? payload?.links?.self?.href ?? "";
  return String(href).match(/\/persons\/([^/?#]+)/)?.[1] ?? null;
}

function nameOf(person: AnyObject): { nombres: string; apellidos: string } {
  const forms = person?.names?.flatMap((n: AnyObject) => n?.nameForms ?? []) ?? [];
  const preferred = person?.names?.find((n: AnyObject) => n?.preferred)?.nameForms?.[0] ?? forms[0];
  const parts = preferred?.parts ?? [];
  const given = parts.find((p: AnyObject) => String(p?.type ?? "").endsWith("/Given"))?.value;
  const surname = parts.find((p: AnyObject) => String(p?.type ?? "").endsWith("/Surname"))?.value;
  if (given || surname) return { nombres: given ?? "(sin nombre)", apellidos: surname ?? "(sin apellido)" };
  const full = String(preferred?.fullText ?? "").trim();
  if (full) {
    const split = full.split(/\s+/);
    return split.length === 1
      ? { nombres: split[0], apellidos: "(sin apellido)" }
      : { nombres: split.slice(0, -1).join(" "), apellidos: split.at(-1) ?? "(sin apellido)" };
  }
  return { nombres: "(sin nombre)", apellidos: "(sin apellido)" };
}

function factOf(person: AnyObject, factType: string) {
  return person?.facts?.find((f: AnyObject) => String(f?.type ?? "").endsWith(factType)) ?? null;
}

function dateOf(person: AnyObject, factType: string): string | null {
  const fact = factOf(person, factType);
  const formal = String(fact?.date?.formal ?? "");
  const m = formal.match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2] ?? "01"}-${m[3] ?? "01"}`;
}

function placeOf(person: AnyObject, factType: string): string | null {
  return factOf(person, factType)?.place?.original ?? null;
}

function sexOf(person: AnyObject): "M" | "F" | null {
  const t = String(person?.gender?.type ?? "");
  if (t.endsWith("/Male")) return "M";
  if (t.endsWith("/Female")) return "F";
  return null;
}

function relationshipEndpoints(r: AnyObject) {
  const aFs = r?.person1?.resourceId ?? (String(r?.person1?.resource ?? "").replace(/^#/, "") || null);
  const bFs = r?.person2?.resourceId ?? (String(r?.person2?.resource ?? "").replace(/^#/, "") || null);
  return { aFs, bFs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) throw new Error("No autenticado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Sesión GENAIA inválida");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("active_arbol_id").eq("id", user.id).single();
    if (profileError || !profile?.active_arbol_id) throw new Error("Selecciona un árbol activo en Configuración antes de importar.");
    const treeId = profile.active_arbol_id;
    async function readTreeRows(table: string, columns: string) {
      const rows: AnyObject[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(table).select(columns).eq("user_id", user.id).or(`arbol_id.eq.${treeId},arbol_id.is.null`).order("id").range(from, from + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    }


    const body = await req.json().catch(() => ({}));
    const generacionesAsc = Math.max(1, Math.min(Number(body?.generaciones_asc ?? 4), 8));
    const generacionesDesc = Math.max(0, Math.min(Number(body?.generaciones_desc ?? 2), 2));

    const { data: account, error: accountError } = await supabase
      .from("external_accounts")
      .select("id,access_token,refresh_token,expires_at,scope")
      .eq("user_id", user.id)
      .eq("provider", "familysearch")
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account?.access_token) throw new Error("FamilySearch no está conectado. Autoriza FamilySearch antes de importar.");

    const token = await refreshIfNeeded(supabase, account);
    const current = await fsGet(token, "/platform/tree/current-person", { "X-Expect-Override": "200-ok" });
    const meId = currentPersonId(current);
    if (!meId) throw new Error("No se pudo identificar tu persona en el árbol de FamilySearch.");

    const ancestry = await fsGet(token, `/platform/tree/ancestry?person=${encodeURIComponent(meId)}&generations=${generacionesAsc}`);
    const persons: AnyObject[] = [...(ancestry?.persons ?? [])];
    const relationships: AnyObject[] = [...(ancestry?.relationships ?? [])];

    if (generacionesDesc > 0) {
      const desc = await fsGet(token, `/platform/tree/descendancy?person=${encodeURIComponent(meId)}&generations=${generacionesDesc}`);
      const seenPeople = new Set(persons.map((p) => p?.id).filter(Boolean));
      for (const p of desc?.persons ?? []) {
        if (p?.id && !seenPeople.has(p.id)) {
          seenPeople.add(p.id);
          persons.push(p);
        }
      }
      const relKeys = new Set(relationships.map((r) => {
        const { aFs, bFs } = relationshipEndpoints(r);
        return `${r?.type ?? ""}|${aFs ?? ""}|${bFs ?? ""}`;
      }));
      for (const r of desc?.relationships ?? []) {
        const { aFs, bFs } = relationshipEndpoints(r);
        const key = `${r?.type ?? ""}|${aFs ?? ""}|${bFs ?? ""}`;
        if (!relKeys.has(key)) {
          relKeys.add(key);
          relationships.push(r);
        }
      }
    }

    const existing = await readTreeRows("personas", "id,ids_externos");

    const existingByFs = new Map<string, string>();
    for (const e of existing ?? []) {
      const fsId = (e.ids_externos as AnyObject | null)?.familysearch_id;
      if (typeof fsId === "string" && fsId) existingByFs.set(fsId, e.id);
    }

    const fsToLocal = new Map<string, string>();
    let creadas = 0;
    let existentes = 0;
    const erroresPersonas: Array<{ familysearch_id: string | null; error: string }> = [];

    for (const p of persons) {
      if (!p?.id) continue;
      const existingId = existingByFs.get(p.id);
      if (existingId) {
        fsToLocal.set(p.id, existingId);
        existentes++;
        continue;
      }

      const { nombres, apellidos } = nameOf(p);
      const sex = sexOf(p);
      const notes = [
        placeOf(p, "/Birth") ? `Nac. en ${placeOf(p, "/Birth")}` : null,
        placeOf(p, "/Death") ? `Def. en ${placeOf(p, "/Death")}` : null,
        `FamilySearch ID: ${p.id}`,
      ].filter(Boolean).join(" · ");

      const row = {
        arbol_id: treeId,
        user_id: user.id,
        nombres,
        apellidos,
        sexo: sex === "M" ? "masculino" : sex === "F" ? "femenino" : null,
        nac_fecha: dateOf(p, "/Birth"),
        defuncion_fecha: dateOf(p, "/Death"),
        bautismo_fecha: dateOf(p, "/Christening") ?? dateOf(p, "/Baptism"),
        viva: p.living === true ? "si" : p.living === false ? "no" : "desconocido",
        certeza: "probable",
        ids_externos: { familysearch_id: p.id, import_source: "FamilySearch" },
        enlaces: {},
        notas: notes || null,
        sync_to_fs: false,
      };
      const { data: inserted, error: insertError } = await supabase.from("personas").insert(row).select("id").single();
      if (insertError || !inserted?.id) {
        erroresPersonas.push({ familysearch_id: p.id, error: insertError?.message ?? "No se pudo insertar" });
        continue;
      }
      fsToLocal.set(p.id, inserted.id);
      existingByFs.set(p.id, inserted.id);
      creadas++;
    }

    const existingRels = await readTreeRows("relaciones", "id,persona_id,pariente_id,tipo");

    const relSet = new Set((existingRels ?? []).map((r: AnyObject) => `${r.persona_id}|${r.pariente_id}|${r.tipo}`));
    let relsCreadas = 0;
    let relsExistentes = 0;
    const erroresRelaciones: string[] = [];

    async function ensureRel(personaId: string, parienteId: string, tipo: string) {
      const key = `${personaId}|${parienteId}|${tipo}`;
      if (relSet.has(key)) {
        relsExistentes++;
        return;
      }
      const { error } = await supabase.from("relaciones").insert({
        arbol_id: treeId,
        user_id: user.id,
        persona_id: personaId,
        pariente_id: parienteId,
        tipo,
        naturaleza: "biologica",
        certeza: "probable",
      });
      if (error) erroresRelaciones.push(error.message);
      if (!error) {
        relSet.add(key);
        relsCreadas++;
      }
    }

    for (const r of relationships) {
      const type = String(r?.type ?? "");
      const { aFs, bFs } = relationshipEndpoints(r);
      if (!aFs || !bFs) continue;
      const aId = fsToLocal.get(aFs);
      const bId = fsToLocal.get(bFs);
      if (!aId || !bId) continue;

      if (type.endsWith("/Couple")) {
        await ensureRel(aId, bId, "conyuge");
        await ensureRel(bId, aId, "conyuge");
      } else if (type.endsWith("/ParentChild")) {
        const parent = persons.find((p) => p?.id === aFs);
        const parentSex = sexOf(parent ?? {});
        const tipoPadre = parentSex === "F" ? "madre" : "padre";
        await ensureRel(bId, aId, tipoPadre);
        await ensureRel(aId, bId, "hijo");
      }
    }

    await supabase.from("actividad").insert({
      user_id: user.id,
      tipo: "import",
      descripcion: `Sincronización FamilySearch: ${creadas} personas nuevas, ${relsCreadas} relaciones nuevas`,
      metadata: {
        source: "familysearch",
        environment: isBeta ? "beta" : "production",
        current_person_id: meId,
        generaciones_asc: generacionesAsc,
        generaciones_desc: generacionesDesc,
        creadas,
        existentes,
        relsCreadas,
        relsExistentes,
        erroresPersonas: erroresPersonas.length,
      },
    });

    return json({
      ok: true,
      creadas, relsCreadas, errores: erroresPersonas.length + erroresRelaciones.length,
      currentPersonId: meId,
      generations: { ancestry: generacionesAsc, descendants: generacionesDesc },
      persons: { totalFromFamilySearch: persons.length, created: creadas, alreadyPresent: existentes, errors: erroresPersonas },
      relationships: { totalFromFamilySearch: relationships.length, created: relsCreadas, alreadyPresent: relsExistentes },
    });
  } catch (error: any) {
    return json({ error: error?.message ?? "Error importando FamilySearch" }, 400);
  }
});
