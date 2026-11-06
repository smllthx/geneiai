import { nameAgreement, nameForms, normalize, type IdentityProfile } from "./neuralIdentity.ts";
export type CandidatePerson = { id: string; nombres: string; apellidos: string; variantes_nombre?: string[] | null; nac_fecha?: string | null; nac_rango_ini?: number | null; nac_rango_fin?: number | null; nac_fecha_aprox?: string | null; defuncion_fecha?: string | null; nac_lugar_id?: string | null; sexo?: string | null };
type Equivalence = { nombre_base: string; equivalente: string };
function year(person: CandidatePerson) {
  if (person.nac_fecha) return Number(person.nac_fecha.slice(0,4)) || null;
  if (person.nac_rango_ini != null && person.nac_rango_ini === person.nac_rango_fin) return person.nac_rango_ini;
  const match = /^(?:hacia|circa|abt|aprox\.?)?\s*(\d{4})$/i.exec(person.nac_fecha_aprox || "");
  return match ? Number(match[1]) : null;
}
function identity(person: CandidatePerson, equivalents: Equivalence[]): IdentityProfile {
  const aliases = [...person.variantes_nombre || []];
  const given = normalize(person.nombres);
  for (const pair of equivalents) {
    if (normalize(pair.nombre_base) === given) aliases.push(`${pair.equivalente} ${person.apellidos}`);
    if (normalize(pair.equivalente) === given) aliases.push(`${pair.nombre_base} ${person.apellidos}`);
  }
  // Registered multi-word given names may also omit the surname.
  for (const alias of [...aliases]) if (!normalize(alias).includes(normalize(person.apellidos))) aliases.push(`${alias} ${person.apellidos}`);
  return { name: `${person.nombres} ${person.apellidos}`, aliases, birthYear: year(person) };
}
/** Candidate retrieval only. No probability and no automatic identity decision. */
export function findIdentityCandidates(people: CandidatePerson[], equivalents: Equivalence[] = []) {
  const profiles = people.map(p => identity(p,equivalents));
  const buckets = new Map<string, number[]>();
  const pairs = new Set<string>();
  const found: { a: CandidatePerson; b: CandidatePerson; indicios: string[]; contradicciones: string[]; priority: number }[] = [];
  people.forEach((person, index) => {
    const keys = new Set(nameForms(profiles[index]).flatMap(name => {
      const words = name.split(" ");
      return [words.at(-1), normalize(person.apellidos)].filter(Boolean).flatMap(word => [`p:${word!.slice(0,3)}`,`s:${word!.slice(-3)}`]);
    }));
    for (const key of keys) {
      for (const other of buckets.get(key) || []) {
        const pair = `${other}|${index}`;
        if (pairs.has(pair)) continue;
        pairs.add(pair);
        const a=people[other], b=person, agreement=nameAgreement(profiles[other],profiles[index]);
        if (!agreement.full && (agreement.given < 0.7 || agreement.family < 0.7)) continue;
        const indicios = [agreement.full ? "Coincide el nombre completo o una variante registrada" : "Nombres y apellidos de forma parecida"];
        const contradicciones: string[] = [];
        let priority = agreement.full ? 4 : 1;
        const ya=year(a),yb=year(b);
        if (a.nac_fecha && b.nac_fecha && a.nac_fecha === b.nac_fecha) { indicios.push("Misma fecha de nacimiento registrada"); priority+=4; }
        else if (ya && yb) {
          if (Math.abs(ya-yb)<=3) { indicios.push("Años de nacimiento próximos"); priority+=2; }
          else contradicciones.push(`Años de nacimiento distintos (${ya} y ${yb})`);
        }
        if (a.nac_lugar_id && a.nac_lugar_id===b.nac_lugar_id) { indicios.push("Mismo lugar de nacimiento registrado");priority+=2; }
        if (a.defuncion_fecha && b.defuncion_fecha && a.defuncion_fecha !== b.defuncion_fecha) contradicciones.push("Fechas de defunción distintas");
        if (a.sexo && b.sexo && a.sexo !== b.sexo && a.sexo !== "desconocido" && b.sexo !== "desconocido") contradicciones.push("Sexo registrado distinto");
        if (agreement.middleConflict) contradicciones.push("Segundos nombres incompatibles");
        found.push({a,b,indicios,contradicciones,priority:priority-contradicciones.length*3});
      }
      buckets.set(key,[...(buckets.get(key)||[]),index]);
    }
  });
  return found.sort((a,b)=>b.priority-a.priority || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
}
