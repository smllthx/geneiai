import { describe, it, expect } from "vitest";
import { filterPeopleForQuery } from "./personSearch";
import { ageAt, personAge } from "./personDates";
import { parseGedcom } from "./import/gedcom";
import { exportGedcom, gedcomDate } from "../../supabase/functions/_shared/gedcomExport";
import { findIdentityCandidates } from "../../supabase/functions/_shared/identityCandidates";
import { compareIdentity } from "../../supabase/functions/_shared/neuralIdentity";
import { collectRows } from "../../supabase/functions/_shared/collectRows";

describe("reported people-search regressions",()=>{
  const people=[{id:"p1",nombres:"Antonio",apellidos:"Sanguineti"},{id:"p2",nombres:"Francesco",apellidos:"Sanguineti",nac_fecha:"1865-09-08"},{id:"p3",nombres:"Francesco Antonio",apellidos:"Sanguineti"},{id:"p4",nombres:"Francesco",apellidos:"Sanguineti",nac_fecha:"1865-09-08"}];
  it("ranks both exact full names first and excludes surname-only matches",()=>{const results=filterPeopleForQuery(people,"Francesco Sanguineti");expect(results.slice(0,2).map(p=>p.id)).toEqual(["p2","p4"]);expect(results.map(p=>p.id)).not.toContain("p1");});
  it("finds a registered given-name variant",()=>{expect(filterPeopleForQuery([{id:"juan",nombres:"Giovanni",apellidos:"Sanguineti",variantes_nombre:["Juan"]}],"Juan Sanguineti")).toHaveLength(1);});
  it("retains all matching people when calculating the count",()=>{expect(filterPeopleForQuery(Array.from({length:161},(_,i)=>({...people[1],id:String(i)})),"Francesco Sanguineti",{limit:Infinity})).toHaveLength(161);});
});
describe("completed age",()=>{
  it("Francesco died at 45 before his September birthday",()=>expect(personAge({nac_fecha:"1865-09-08",defuncion_fecha:"1911-06-06",viva:"no"})).toBe("45 años"));
  it.each([["1911-09-07","45 años"],["1911-09-08","46 años"],["1911-09-09","46 años"]])("birthday boundary %s",(end,result)=>expect(ageAt({nac_fecha:"1865-09-08"},end)).toBe(result));
  it("labels years and estimated births approximate",()=>{expect(ageAt({nac_fecha_aprox:"hacia 1880"},"1911-06-06")).toBe("aprox. 31 años");expect(ageAt({nac_rango_ini:1880,nac_rango_fin:1882},"1911")).toBe("aprox. 29–31 años");});
  it("does not invent an age for contradictory living status or impossible chronology",()=>{expect(personAge({nac_fecha:"2000-01-01",defuncion_fecha:"2020-01-01",viva:"si"})).toBeNull();expect(ageAt({nac_fecha:"2000-01-01"},"1999-12-31")).toBeNull();});
});
describe("GEDCOM relationship and precision preservation",()=>{
  const people=[{id:"father",nombres:"Padre",sexo:"masculino"},{id:"first",nombres:"Primera",sexo:"femenino"},{id:"second",nombres:"Segunda",sexo:"femenino"},{id:"daughter",nombres:"Hija",nac_fecha_aprox:"hacia 1880"},{id:"single",nombres:"Madre sola",sexo:"femenino"},{id:"child",nombres:"Hijo único"}];
  const relation=(persona_id:string,pariente_id:string,tipo:string)=>({persona_id,pariente_id,tipo});
  const relations=[relation("father","first","conyuge"),relation("second","father","conyuge"),relation("daughter","father","padre"),relation("daughter","first","madre"),relation("father","daughter","hijo"),relation("child","single","madre")];
  it("exports a daughter only in her recorded parents' family",()=>{const parsed=parseGedcom(exportGedcom(people,relations));expect(parsed.familias.find(f=>f.wife==="@I2@")?.children).toEqual(["@I4@"]);expect(parsed.familias.find(f=>f.wife==="@I3@")?.children).toEqual([]);});
  it("retains a mother without a spouse and her child",()=>{const families=parseGedcom(exportGedcom(people,relations)).familias;expect(families.find(f=>f.wife==="@I5@")).toMatchObject({husband:undefined,children:["@I6@"]});});
  it("round-trips approximate birth dates",()=>{const parsed=parseGedcom(exportGedcom(people,relations));expect(parsed.personas[3]).toMatchObject({nac_fecha_aprox:"ABT 1880"});expect(parsed.personas[3].nac_fecha).toBeUndefined();});
  it("retains a single reverse child edge",()=>expect(parseGedcom(exportGedcom(people,[relation("single","child","hijo")])).familias[0]).toMatchObject({wife:"@I5@",children:["@I6@"]}));
  it("preserves multiline, unicode and long notes",()=>{const note="Una historia familiar extensa con espacios " .repeat(7)+"\nOtra línea con acentos y vínculos.";expect(parseGedcom(exportGedcom([{id:"a",nombres:"Ana",notas:note}],[])).personas[0].notas).toBe(note);});
  it("does not turn ranges or year-only births into exact dates",()=>{const out=exportGedcom([{id:"a",nac_rango_ini:1880,nac_rango_fin:1885},{id:"b",nac_rango_ini:1880,nac_rango_fin:1880}],[]);expect(out).toContain("2 DATE BET 1880 AND 1885");expect(out).toContain("2 DATE 1880\n");expect(gedcomDate("antes de 1880")).toBe("BEF 1880");});
  it("ignores dangling/cross-tree endpoints and self-relations",()=>expect(parseGedcom(exportGedcom(people,[relation("daughter","outside","padre"),relation("daughter","daughter","madre")])).familias).toHaveLength(0));
});
describe("identity candidate engines",()=>{
  const giovanni={id:"a",nombres:"Giovanni",apellidos:"Sanguineti",variantes_nombre:["Juan"],nac_fecha:"1865-09-08",nac_lugar_id:"rapallo"};
  const juan={id:"b",nombres:"Juan",apellidos:"Sanguineti",nac_fecha:"1865-09-08",nac_lugar_id:"rapallo"};
  it("retrieves Giovanni/Juan with a registered variant for both detectors",()=>{const candidates=findIdentityCandidates([giovanni,juan]);expect(candidates).toHaveLength(1);expect(candidates[0].indicios).toEqual(expect.arrayContaining(["Misma fecha de nacimiento registrada","Mismo lugar de nacimiento registrado"]));});
  it("also uses owned name equivalences",()=>expect(findIdentityCandidates([{...giovanni,variantes_nombre:[]},juan],[{nombre_base:"Giovanni",equivalente:"Juan"}])).toHaveLength(1));
  it("does not infer unregistered translations",()=>expect(findIdentityCandidates([{...giovanni,variantes_nombre:[]},juan])).toHaveLength(0));
  it("does not duplicate pairs from multiple buckets",()=>expect(findIdentityCandidates([giovanni,juan,{...juan,id:"c"}])).toHaveLength(3));
  it("reports contradictory birth years",()=>expect(findIdentityCandidates([giovanni,{...juan,nac_fecha:"1965-09-08"}])[0].contradicciones).not.toHaveLength(0));
  it("native neural model recognizes the same recorded variant",()=>expect(compareIdentity({name:"Giovanni Sanguineti",aliases:["Juan"],birthYear:1865,birthPlace:"Rapallo"},{name:"Juan Sanguineti",birthYear:1865,birthPlace:"Rapallo"}).score).toBeGreaterThanOrEqual(.7));
  it("never assigns high confidence to absent facts",()=>{expect(compareIdentity({name:""},{name:""}).score).toBeLessThan(.5);expect(compareIdentity({name:"Juan Sanguineti"},{name:"Juan Sanguineti"}).score).toBeLessThan(.5);});
  it("caps contradictory dates",()=>expect(compareIdentity({name:"Juan Sanguineti",birthYear:1800},{name:"Juan Sanguineti",birthYear:1900}).score).toBeLessThanOrEqual(.29));
});
it("paginates all export/detector rows and propagates failures",async()=>{
  const rows=Array.from({length:1203},(_,id)=>({id}));let calls=0;
  expect(await collectRows(async(from,to)=>{calls++;return {data:rows.slice(from,to+1),error:null};})).toHaveLength(1203);expect(calls).toBe(3);
  await expect(collectRows(async()=>({data:null,error:new Error("offline")}))).rejects.toThrow("offline");
});
