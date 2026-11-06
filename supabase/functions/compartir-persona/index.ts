import { canDiscloseDeceasedPerson } from "../_shared/personPrivacy.ts";
import { rejectUnauthenticated } from "../_shared/auth.ts";
// Devuelve una ficha privada dentro de la cuenta y el archivo familiar activos.
// Este endpoint no publica personas ni crea enlaces públicos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget as _pickAiTarget, prepareEconomyChatBody as _prepareEconomyChatBody } from "../_shared/userAi.ts";
import { createOwnedGenealogyPhotoSignedUrl } from "../_shared/photoStorage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

async function _aiFetch(req: Request, body: Record<string, unknown>) {
  const auth = req.headers.get("Authorization");
  const model = typeof body.model === "string" ? body.model : undefined;
  const target = await _pickAiTarget(auth, model);
  const finalBody = _prepareEconomyChatBody(body, target.model);
  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
}

function yearOf(date?: string | null, fallback?: number | null) {
  if (!date) return fallback ?? null;
  const match = date.match(/^(\d{4})/);
  return match ? Number(match[1]) : fallback ?? null;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

Deno.serve(async (req) => {
  const geneaiAccessRejection = await rejectUnauthenticated(req);
  if (geneaiAccessRejection) return geneaiAccessRejection;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization) return jsonResponse({ error: "No autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Falta configuración de Supabase");

    // La consulta usa la sesión del usuario y conserva las políticas RLS. No se
    // emplea la service role para resolver fichas por UUID.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: "Sesión inválida" }, 401);
    const user = authData.user;

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!UUID_RE.test(id)) return jsonResponse({ error: "Identificador de persona inválido" }, 400);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_arbol_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const treeId = typeof profile?.active_arbol_id === "string" ? profile.active_arbol_id.trim() : "";
    if (!treeId) {
      return jsonResponse({ error: "Selecciona un archivo familiar antes de abrir esta ficha privada." }, 409);
    }

    const { data: ownedTree, error: treeError } = await supabase
      .from("arboles")
      .select("id")
      .eq("id", treeId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (treeError) throw treeError;
    if (!ownedTree) {
      return jsonResponse({ error: "El archivo familiar activo no está disponible para esta cuenta." }, 409);
    }

    const { data: person, error: personError } = await supabase
      .from("personas")
      .select("id,user_id,arbol_id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,nac_lugar_id,defuncion_fecha,defuncion_lugar_id,ocupacion,nacionalidad,foto_url,viva")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("arbol_id", treeId)
      .maybeSingle();
    if (personError) throw personError;
    if (!person) return jsonResponse({ error: "Persona no encontrada en el archivo familiar activo" }, 404);

    // Un estado desconocido se trata de forma conservadora igual que una
    // persona viva. La ficha reducida no incluye fecha completa, lugares,
    // fotografía, ocupación, nacionalidad, familiares ni texto generado.
    const knownDeceased = canDiscloseDeceasedPerson(person);
    if (!knownDeceased) {
      return jsonResponse({
        ficha: {
          id: person.id,
          nombres: person.nombres,
          apellidos: person.apellidos,
          sexo: null,
          foto_url: null,
          nacimiento: {
            fecha: null,
            anio: yearOf(person.nac_fecha, person.nac_rango_ini),
            lugar: null,
          },
          defuncion: { fecha: null, anio: null, lugar: null },
          ocupacion: null,
          nacionalidad: null,
          padres: [],
          conyuges: [],
          hijos: [],
          privacidad: "persona_viva_o_estado_desconocido",
        },
        bio: "",
      });
    }

    const placeIds = unique([person.nac_lugar_id, person.defuncion_lugar_id].filter(Boolean) as string[]);
    const placesById: Record<string, { ciudad?: string | null; provincia?: string | null; region?: string | null; pais?: string | null }> = {};
    if (placeIds.length > 0) {
      const { data: places, error: placesError } = await supabase
        .from("lugares")
        .select("id,ciudad,provincia,region,pais")
        .eq("user_id", user.id)
        .in("id", placeIds);
      if (placesError) throw placesError;
      for (const place of places ?? []) placesById[place.id] = place;
    }

    const placeLabel = (placeId?: string | null) => {
      if (!placeId) return null;
      const place = placesById[placeId];
      return place
        ? [place.ciudad, place.provincia ?? place.region, place.pais].filter(Boolean).join(", ") || null
        : null;
    };

    const { data: relations, error: relationsError } = await supabase
      .from("relaciones")
      .select("persona_id,pariente_id,tipo")
      .eq("user_id", user.id)
      .eq("arbol_id", treeId)
      .or(`persona_id.eq.${id},pariente_id.eq.${id}`)
      .limit(500);
    if (relationsError) throw relationsError;

    const parentsIds = unique((relations ?? [])
      .filter((relation) => relation.persona_id === id && (relation.tipo === "padre" || relation.tipo === "madre"))
      .map((relation) => relation.pariente_id));
    const spousesIds = unique((relations ?? [])
      .filter((relation) => relation.tipo === "conyuge")
      .map((relation) => relation.persona_id === id ? relation.pariente_id : relation.persona_id));
    const childrenIds = unique((relations ?? [])
      .filter((relation) => relation.persona_id === id && relation.tipo === "hijo")
      .map((relation) => relation.pariente_id));
    const relativeIds = unique([...parentsIds, ...spousesIds, ...childrenIds]);

    const relativeNames: Record<string, string> = {};
    if (relativeIds.length > 0) {
      const { data: relatives, error: relativesError } = await supabase
        .from("personas")
        .select("id,nombres,apellidos,viva,defuncion_fecha")
        .eq("user_id", user.id)
        .eq("arbol_id", treeId)
        .in("id", relativeIds);
      if (relativesError) throw relativesError;
      for (const relative of relatives ?? []) {
        // No revelar siquiera el nombre de familiares vivos o cuyo estado de
        // vida no esté confirmado dentro de esta vista compartible.
        if (canDiscloseDeceasedPerson(relative)) {
          relativeNames[relative.id] = `${relative.nombres} ${relative.apellidos}`.trim();
        }
      }
    }

    const signedPhoto = await createOwnedGenealogyPhotoSignedUrl(supabase, {
      reference: person.foto_url,
      userId: user.id,
      treeId,
      expiresIn: 300,
    });

    const ficha = {
      id: person.id,
      nombres: person.nombres,
      apellidos: person.apellidos,
      sexo: person.sexo,
      // URL transitoria sólo para esta respuesta autenticada. Si la firma
      // falla, no se devuelve la antigua URL pública como alternativa.
      foto_url: signedPhoto?.signedUrl ?? null,
      nacimiento: {
        fecha: person.nac_fecha,
        anio: yearOf(person.nac_fecha, person.nac_rango_ini),
        lugar: placeLabel(person.nac_lugar_id),
      },
      defuncion: {
        fecha: person.defuncion_fecha,
        anio: yearOf(person.defuncion_fecha),
        lugar: placeLabel(person.defuncion_lugar_id),
      },
      ocupacion: person.ocupacion ?? null,
      nacionalidad: person.nacionalidad ?? null,
      padres: parentsIds.map((relativeId) => relativeNames[relativeId]).filter(Boolean),
      conyuges: spousesIds.map((relativeId) => relativeNames[relativeId]).filter(Boolean),
      hijos: childrenIds.map((relativeId) => relativeNames[relativeId]).filter(Boolean),
      privacidad: "privada_autenticada",
    };

    // La IA solo redacta una vista transitoria para personas confirmadas como
    // fallecidas y recibe únicamente el subconjunto ya sanitizado.
    let bio = "";
    try {
      const aiResponse = await _aiFetch(req, {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Escribe en español una mini biografía genealógica de 3 o 4 frases basada estrictamente en los datos provistos. No inventes ni completes datos ausentes.",
          },
          // La foto no es necesaria para redactar y la URL firmada no se
          // transmite al proveedor de texto.
          { role: "user", content: JSON.stringify({ ...ficha, foto_url: null }) },
        ],
      });
      if (aiResponse.ok) {
        const result = await aiResponse.json();
        bio = result.choices?.[0]?.message?.content ?? "";
      }
    } catch {
      // La ficha privada sigue disponible si la redacción opcional no responde.
    }

    return jsonResponse({ ficha, bio });
  } catch (error) {
    console.error("compartir-persona failed", error);
    return jsonResponse({ error: "No se pudo cargar la ficha privada" }, 500);
  }
});
