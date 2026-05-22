import { supabase } from "@/integrations/supabase/client";

const MAX_GEN = 10;
const FUENTE_TAG = "Cálculo por árbol";

export type EthnicidadCalc = { region: string; porcentaje: number; cobertura: number };

/**
 * Calcula composición étnica recorriendo ancestros desde un proband.
 * Cada padre = 50%, abuelo = 25%, etc. El origen se toma de:
 *   1) nacionalidad
 *   2) país del lugar de nacimiento
 *   3) "Desconocido"
 * Si solo uno de los dos padres es conocido, su mitad se duplica para
 * mantener el 100% (evita inflar "Desconocido").
 */
export async function calcularEtnicidadPorArbol(probandId: string) {
  const [{ data: personas }, { data: rels }, { data: lugares }] = await Promise.all([
    supabase.from("personas").select("id,nombres,apellidos,nacionalidad,nac_lugar_id"),
    supabase.from("relaciones").select("persona_id,pariente_id,tipo"),
    supabase.from("lugares").select("id,pais"),
  ]);

  const byId = new Map<string, any>((personas ?? []).map((p: any) => [p.id, p]));
  const lugarPais = new Map<string, string>((lugares ?? []).map((l: any) => [l.id, l.pais ?? ""]));

  const padresDe = (pid: string): { padre?: string; madre?: string } => {
    const ids: any[] = [];
    for (const r of rels ?? []) {
      if (r.persona_id === pid && (r.tipo === "padre" || r.tipo === "madre")) ids.push({ id: r.pariente_id, tipo: r.tipo });
      if (r.pariente_id === pid && r.tipo === "hijo") ids.push({ id: r.persona_id, tipo: "padre?" });
    }
    let padre: string | undefined;
    let madre: string | undefined;
    for (const x of ids) {
      const p = byId.get(x.id);
      if (!p) continue;
      if (x.tipo === "padre") padre ??= p.id;
      else if (x.tipo === "madre") madre ??= p.id;
      else if (p.sexo === "masculino") padre ??= p.id;
      else if (p.sexo === "femenino") madre ??= p.id;
      else (padre ? madre ??= p.id : (padre = p.id));
    }
    return { padre, madre };
  };

  const origenDe = (pid: string): string | null => {
    const p = byId.get(pid);
    if (!p) return null;
    const nac = (p.nacionalidad ?? "").trim();
    if (nac) return nac;
    const pais = (lugarPais.get(p.nac_lugar_id ?? "") ?? "").trim();
    if (pais) return pais;
    return null;
  };

  const acc = new Map<string, number>();
  let cobertura = 0;

  const visitar = (id: string | undefined, peso: number, gen: number, seen: Set<string>) => {
    if (!id || peso <= 0 || gen > MAX_GEN || seen.has(id)) return;
    seen.add(id);
    const { padre, madre } = padresDe(id);
    if (!padre && !madre) {
      // hoja: atribuir a su origen
      const o = origenDe(id);
      if (o) { acc.set(o, (acc.get(o) ?? 0) + peso); cobertura += peso; }
      return;
    }
    // distribuir peso entre padres conocidos (para mantener 100%)
    const conocidos = [padre, madre].filter(Boolean) as string[];
    const cuota = peso / conocidos.length;
    for (const pid of conocidos) visitar(pid, cuota, gen + 1, new Set(seen));
  };

  // Empezamos atribuyendo origen del proband también, pero solo si no tiene padres
  const { padre, madre } = padresDe(probandId);
  if (!padre && !madre) {
    const o = origenDe(probandId);
    if (o) { acc.set(o, 1); cobertura = 1; }
  } else {
    const conocidos = [padre, madre].filter(Boolean) as string[];
    const cuota = 1 / conocidos.length;
    for (const pid of conocidos) visitar(pid, cuota, 1, new Set([probandId]));
  }

  // Normalizar a 100% sobre lo cubierto
  const total = [...acc.values()].reduce((s, v) => s + v, 0);
  const items: EthnicidadCalc[] = [];
  if (total > 0) {
    for (const [region, peso] of acc.entries()) {
      items.push({ region, porcentaje: (peso / total) * 100, cobertura });
    }
  }
  items.sort((a, b) => b.porcentaje - a.porcentaje);
  return { items, cobertura };
}

export async function guardarEtnicidadArbol(probandId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No hay sesión");
  const { items, cobertura } = await calcularEtnicidadPorArbol(probandId);
  if (items.length === 0) return { insertados: 0, cobertura };

  // Borrar cálculo previo por árbol del mismo usuario
  await supabase.from("dna_estimates").delete().eq("user_id", user.id).eq("fuente", FUENTE_TAG);

  const rows = items.map((i) => ({
    user_id: user.id,
    region: i.region,
    porcentaje: Number(i.porcentaje.toFixed(2)),
    fuente: FUENTE_TAG,
    rama: null,
  }));
  const { error } = await supabase.from("dna_estimates").insert(rows);
  if (error) throw error;
  return { insertados: rows.length, cobertura };
}
