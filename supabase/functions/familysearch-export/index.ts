// Exporta el árbol local del usuario como GEDCOM 5.5.1
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const monthAbbr = ["", "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  return `${parseInt(m[3])} ${monthAbbr[parseInt(m[2])]} ${m[1]}`;
};

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

    const [{ data: personas }, { data: relaciones }] = await Promise.all([
      supabase.from("personas").select("*"),
      supabase.from("relaciones").select("*"),
    ]);

    const lines: string[] = [];
    lines.push("0 HEAD", "1 SOUR ArchivoFamiliar", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8");

    const idxOf = new Map<string, number>();
    (personas ?? []).forEach((p, i) => idxOf.set(p.id, i + 1));

    for (const p of personas ?? []) {
      const xref = `@I${idxOf.get(p.id)}@`;
      lines.push(`0 ${xref} INDI`);
      lines.push(`1 NAME ${p.nombres} /${p.apellidos}/`);
      if (p.sexo) lines.push(`1 SEX ${p.sexo === "femenino" ? "F" : p.sexo === "masculino" ? "M" : "U"}`);
      if (p.nac_fecha) {
        lines.push("1 BIRT");
        lines.push(`2 DATE ${fmtDate(p.nac_fecha)}`);
      }
      if (p.defuncion_fecha) {
        lines.push("1 DEAT");
        lines.push(`2 DATE ${fmtDate(p.defuncion_fecha)}`);
      }
      if (p.ocupacion) lines.push(`1 OCCU ${p.ocupacion}`);
      if (p.notas) lines.push(`1 NOTE ${(p.notas as string).replace(/\n/g, " ").slice(0, 200)}`);
    }

    // Familias a partir de cónyuges + hijos
    const couples = new Map<string, { husb?: string; wife?: string; children: Set<string> }>();
    const keyOf = (a: string, b: string) => [a, b].sort().join("|");

    for (const r of relaciones ?? []) {
      if (r.tipo === "conyuge") {
        const k = keyOf(r.persona_id, r.pariente_id);
        if (!couples.has(k)) {
          const a = (personas ?? []).find((x) => x.id === r.persona_id);
          const b = (personas ?? []).find((x) => x.id === r.pariente_id);
          const husb = a?.sexo === "masculino" ? r.persona_id : b?.sexo === "masculino" ? r.pariente_id : r.persona_id;
          const wife = husb === r.persona_id ? r.pariente_id : r.persona_id;
          couples.set(k, { husb, wife, children: new Set() });
        }
      }
    }
    for (const r of relaciones ?? []) {
      if (r.tipo === "padre" || r.tipo === "madre") {
        // child = persona_id, parent = pariente_id
        for (const [, fam] of couples) {
          if (fam.husb === r.pariente_id || fam.wife === r.pariente_id) {
            fam.children.add(r.persona_id);
          }
        }
      }
    }

    let famN = 0;
    for (const [, fam] of couples) {
      famN++;
      lines.push(`0 @F${famN}@ FAM`);
      if (fam.husb && idxOf.get(fam.husb)) lines.push(`1 HUSB @I${idxOf.get(fam.husb)}@`);
      if (fam.wife && idxOf.get(fam.wife)) lines.push(`1 WIFE @I${idxOf.get(fam.wife)}@`);
      for (const c of fam.children) {
        if (idxOf.get(c)) lines.push(`1 CHIL @I${idxOf.get(c)}@`);
      }
    }
    lines.push("0 TRLR");

    return new Response(lines.join("\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=arbol-familiar.ged`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
