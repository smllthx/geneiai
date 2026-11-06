type Person = { id: string; nombres?: string; apellidos?: string; sexo?: string | null; [key: string]: unknown };
type Relation = { persona_id: string; pariente_id: string; tipo: string; naturaleza?: string | null; certeza?: string | null; notas?: string | null };
type Place = { id: string; ciudad?: string | null; provincia?: string | null; region?: string | null; pais?: string | null; parroquia?: string | null };
const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const text = (value: unknown) => typeof value === "string" ? value : "";
export function gedcomDate(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw);
  if (iso && months[Number(iso[2]) - 1]) return `${iso[3] ? Number(iso[3]) + " " : ""}${months[Number(iso[2]) - 1]} ${iso[1]}`;
  const qualified = raw.replace(/^(hacia|circa|c\.|aprox\.?)\s*/i, "ABT ")
    .replace(/^antes de\s+/i, "BEF ").replace(/^después de\s+/i, "AFT ")
    .replace(/^entre (.+) y (.+)$/i, "BET $1 AND $2");
  if (/^(?:(?:ABT|CAL|EST|BEF|AFT|FROM|TO|BET)\s+)?[\d A-Z]+$/i.test(qualified)) return qualified.toUpperCase();
  return `(${raw.replace(/[\r\n()]/g, " ")})`;
}
export function gedcomBirth(person: Person): string {
  if (person.nac_fecha) return gedcomDate(person.nac_fecha);
  if (person.nac_fecha_aprox) return gedcomDate(/^\d{4}$/.test(text(person.nac_fecha_aprox)) ? `ABT ${person.nac_fecha_aprox}` : person.nac_fecha_aprox);
  const start = person.nac_rango_ini, end = person.nac_rango_fin;
  if (typeof start === "number" && typeof end === "number") return start === end ? String(start) : `BET ${start} AND ${end}`;
  return typeof start === "number" ? `FROM ${start}` : typeof end === "number" ? `TO ${end}` : "";
}

/** Export only recorded parent edges. A spouse is never inferred to be a child's parent. */
export function exportGedcom(people: Person[], relations: Relation[], places: Place[] = []): string {
  const byId = new Map(people.map(p => [p.id, p]));
  const ids = new Map(people.map((p, index) => [p.id, `@I${index + 1}@`]));
  const placeById = new Map(places.map(p => [p.id, [p.parroquia,p.ciudad,p.provincia,p.region,p.pais].filter(Boolean).join(", ")]));
  const valid = relations.filter(r => r.persona_id !== r.pariente_id && byId.has(r.persona_id) && byId.has(r.pariente_id));
  type Family = { xref: string; parents: string[]; married: boolean; children: Map<string, string> };
  const families = new Map<string, Family>();
  function family(parents: string[], married = false) {
    const ordered = [...new Set(parents)].sort();
    const key = ordered.join("|");
    let result = families.get(key);
    if (!result) { result = { xref: `@F${families.size + 1}@`, parents: ordered, married, children: new Map() }; families.set(key,result); }
    result.married ||= married;
    return result;
  }
  for (const r of valid) if (r.tipo === "conyuge") family([r.persona_id,r.pariente_id],true);
  const parentGroups = new Map<string, { child: string; nature: string; parents: Set<string> }>();
  for (const r of valid) {
    if (!["padre","madre","hijo"].includes(r.tipo)) continue;
    const child = r.tipo === "hijo" ? r.pariente_id : r.persona_id;
    const parent = r.tipo === "hijo" ? r.persona_id : r.pariente_id;
    const nature = r.naturaleza || "biologica";
    const key = `${child}|${nature}`;
    const group = parentGroups.get(key) || { child, nature, parents: new Set<string>() };
    group.parents.add(parent); parentGroups.set(key, group);
  }
  for (const group of parentGroups.values()) {
    const parents = [...group.parents];
    // More than two recorded parents cannot be safely paired without family provenance.
    for (const set of parents.length <= 2 ? [parents] : parents.map(p => [p])) family(set).children.set(group.child,group.nature);
  }
  const lines = ["0 HEAD","1 SOUR GENEAI","1 SUBM @SUB1@","1 GEDC","2 VERS 5.5.1","2 FORM LINEAGE-LINKED","1 CHAR UTF-8","0 @SUB1@ SUBM","1 NAME GENEAI"];
  function add(level: number, tag: string, value: string) {
    value.replace(/\r\n?/g,"\n").split("\n").forEach((line,lineIndex) => {
      const chunks = Array.from(line).join("").match(/.{1,50}/gu) || [""];
      chunks.forEach((chunk,i) => lines.push(`${i || lineIndex ? level + 1 : level} ${i ? "CONC" : lineIndex ? "CONT" : tag}${chunk ? ` ${chunk}` : ""}`));
    });
  }
  for (const p of people) {
    lines.push(`0 ${ids.get(p.id)} INDI`);
    add(1,"NAME",`${text(p.nombres).replace(/\//g," ")} /${text(p.apellidos).replace(/\//g," ")}/`);
    if (Array.isArray(p.variantes_nombre)) for (const alias of p.variantes_nombre) if (typeof alias === "string" && alias.trim()) add(1,"NAME",alias);
    if (p.sexo) lines.push(`1 SEX ${p.sexo === "femenino" ? "F" : p.sexo === "masculino" ? "M" : "U"}`);
    for (const [tag,dateKey,placeKey] of [["BIRT","nac_fecha","nac_lugar_id"],["BAPM","bautismo_fecha","bautismo_lugar_id"],["DEAT","defuncion_fecha","defuncion_lugar_id"],["BURI","entierro_fecha","entierro_lugar_id"]]) {
      const date = tag === "BIRT" ? gedcomBirth(p) : gedcomDate(p[dateKey]);
      const place = placeById.get(text(p[placeKey]));
      if (!date && !place && !(tag === "DEAT" && p.viva === "no")) continue;
      lines.push(`1 ${tag}${!date && !place ? " Y" : ""}`);
      if (date) add(2,"DATE",date);
      if (place) add(2,"PLAC",place);
    }
    for (const [key,tag] of [["ocupacion","OCCU"],["nacionalidad","NATI"],["notas","NOTE"]]) if (text(p[key])) add(1,tag,text(p[key]));
    for (const fam of families.values()) {
      if (fam.parents.includes(p.id)) lines.push(`1 FAMS ${fam.xref}`);
      if (fam.children.has(p.id)) {
        lines.push(`1 FAMC ${fam.xref}`);
        const nature = fam.children.get(p.id);
        if (["adoptiva","biologica","acogida"].includes(nature || "")) lines.push(`2 PEDI ${nature === "adoptiva" ? "adopted" : nature === "biologica" ? "birth" : nature === "acogida" ? "foster" : ""}`);
        if (nature !== "biologica" && nature !== "adoptiva") add(2,"NOTE",`Naturaleza registrada: ${nature}`);
      }
    }
  }
  for (const fam of families.values()) {
    lines.push(`0 ${fam.xref} FAM`);
    const parents = [...fam.parents].sort((a,b) => Number(byId.get(a)?.sexo === "femenino") - Number(byId.get(b)?.sexo === "femenino"));
    parents.forEach((parent,index) => lines.push(`1 ${parents.length === 1 ? byId.get(parent)?.sexo === "femenino" ? "WIFE" : "HUSB" : index ? "WIFE" : "HUSB"} ${ids.get(parent)}`));
    for (const child of fam.children.keys()) lines.push(`1 CHIL ${ids.get(child)}`);
    if (fam.married) {
      const dates = fam.parents.filter(parent => [...families.values()].filter(f => f.married && f.parents.includes(parent)).length === 1)
        .map(parent => gedcomDate(byId.get(parent)?.matrimonio_fecha)).filter(Boolean);
      if (new Set(dates).size === 1) lines.push("1 MARR",`2 DATE ${dates[0]}`);
    }
  }
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}
