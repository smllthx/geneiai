// @vitest-environment node
import { beforeAll, describe, it, expect } from "vitest";
import { build } from "esbuild";
import vm from "node:vm";
import path from "node:path";
import { parseGedcom } from "../src/lib/import/gedcom";
const owner="11111111-1111-4111-8111-111111111111",tree="22222222-2222-4222-8222-222222222222",personId="33333333-3333-4333-8333-333333333333";
const compiled=new Map<string,string>();
beforeAll(async()=>{
  for(const slug of ["compartir-persona","familysearch-export","detectar-duplicados","detectar-coincidencias"]){
    const result=await build({entryPoints:[path.resolve(`supabase/functions/${slug}/index.ts`)],bundle:true,write:false,platform:"node",format:"cjs",plugins:[{name:"simulated-supabase",setup(builder){builder.onResolve({filter:/^(https:|npm:)/},args=>({path:args.path,namespace:"mock"}));builder.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:'export const createClient = () => globalThis.__database; export const corsHeaders = { "Access-Control-Allow-Origin": "*" };',loader:"js"}));}}]});
    compiled.set(slug,result.outputFiles[0].text);
  }
});
function fixture(extra:Record<string,any[]>={}) {
  const data:Record<string,any[]>={profiles:[{id:owner,active_arbol_id:tree}],arboles:[{id:tree,user_id:owner}],personas:[{id:personId,user_id:owner,arbol_id:tree,nombres:"Persona",apellidos:"De prueba",viva:"si",nac_fecha:"2003-03-12",defuncion_fecha:"2020-01-01"}],relaciones:[],lugares:[],app_config:[],equivalencias_nombre:[],coincidencias:[],sugerencias:[],actividad:[],...extra};
  const writes:any[]=[],aiCalls:any[]=[];
  const database={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from(table:string){
    let rows=[...(data[table]||[])],from=0,to=999,single=false,mutation:any=null;
    const query:any={select(){return query;},eq(k:string,v:unknown){rows=rows.filter(r=>r[k]===v);return query;},is(k:string,v:unknown){rows=rows.filter(r=>(r[k]??null)===v);return query;},in(k:string,values:any[]){rows=rows.filter(r=>values.includes(r[k]));return query;},or(){return query;},order(){return query;},range(a:number,b:number){from=a;to=b;return query;},limit(n:number){to=n-1;return query;},maybeSingle(){single=true;return query;},single(){single=true;return query;},insert(values:any){mutation=Array.isArray(values)?values:[values];rows=mutation.map((r:any,i:number)=>({id:`inserted-${i}`,...r}));writes.push({table,rows});return query;},delete(){rows=[];return query;},then(resolve:any,reject:any){return Promise.resolve({data:single?rows[0]??null:rows.slice(from,to+1),error:null}).then(resolve,reject);}};return query;
  }};
  async function invoke(slug:string,body:any={id:personId},authorized=true){
    let handler:(req:Request)=>Promise<Response>;
    const context={__database:database,Request,Response,Headers,AbortSignal,console,Deno:{env:{get:(key:string)=>({SUPABASE_URL:"https://camdtylwddleifaegzaf.supabase.co",SUPABASE_ANON_KEY:"public-test-key",OPENAI_API_KEY:"fake-provider-key"})[key]},serve:(fn:any)=>handler=fn},fetch:async(url:string,options:any)=>{if(url.endsWith("/auth/v1/user"))return Response.json({id:owner});aiCalls.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:"Biografía simulada"}}]});}};
    vm.runInNewContext(compiled.get(slug)!,context);
    return handler!(new Request("https://example.test",{method:"POST",headers:authorized?{Authorization:"Bearer fake.token.value","Content-Type":"application/json"}:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
  }
  return {invoke,writes,aiCalls};
}
describe("deployed-handler regressions with simulated DB and AI",()=>{
  it("contradictory living person never reaches an AI provider or discloses exact birth",async()=>{const f=fixture();const response=await f.invoke("compartir-persona");expect(response.status).toBe(200);const body=await response.json();expect(body.ficha.nacimiento.fecha).toBeNull();expect(body.bio).toBe("");expect(f.aiCalls).toHaveLength(0);});
  it("unknown status remains private even with a death date",async()=>{const f=fixture({personas:[{id:personId,user_id:owner,arbol_id:tree,viva:"desconocido",defuncion_fecha:"1911-06-06",nac_fecha:"1865-09-08"}]});expect((await (await f.invoke("compartir-persona")).json()).ficha.nacimiento.fecha).toBeNull();expect(f.aiCalls).toHaveLength(0);});
  it("explicitly deceased records can use the simulated AI",async()=>{const f=fixture({personas:[{id:personId,user_id:owner,arbol_id:tree,nombres:"Ana",apellidos:"Prueba",viva:"no",nac_fecha:"1865-09-08",defuncion_fecha:"1911-06-06"}]});expect((await f.invoke("compartir-persona")).status).toBe(200);expect(f.aiCalls).toHaveLength(1);});
  it.each(["compartir-persona","familysearch-export","detectar-duplicados","detectar-coincidencias"])("rejects unauthenticated calls to %s",async(slug)=>{const f=fixture();expect((await f.invoke(slug,{},false)).status).toBe(401);expect(f.aiCalls).toHaveLength(0);expect(f.writes).toHaveLength(0);});
  it("does not disclose a person owned by another account",async()=>{const f=fixture({personas:[{id:personId,user_id:"other",arbol_id:tree,viva:"no"}]});expect((await f.invoke("compartir-persona")).status).toBe(404);expect(f.aiCalls).toHaveLength(0);});
  it.each(["detectar-duplicados","detectar-coincidencias"])("%s retrieves Giovanni/Juan and preserves unverified score zero",async(slug)=>{
    const f=fixture({personas:[{id:"a",user_id:owner,arbol_id:tree,nombres:"Giovanni",apellidos:"Sanguineti",variantes_nombre:["Juan"],nac_fecha:"1865-09-08",nac_lugar_id:"rapallo"},{id:"b",user_id:owner,arbol_id:tree,nombres:"Juan",apellidos:"Sanguineti",nac_fecha:"1865-09-08",nac_lugar_id:"rapallo"},{id:"outside",user_id:owner,arbol_id:"other-tree",nombres:"Juan",apellidos:"Sanguineti"}]});
    const response=await f.invoke(slug,{});expect(response.status).toBe(200);const target=f.writes.find(w=>w.table===(slug==="detectar-duplicados"?"sugerencias":"coincidencias"));expect(target.rows).toHaveLength(1);expect(target.rows[0].score??target.rows[0].confianza).toBe(0);expect(JSON.stringify(target.rows)).not.toContain("outside");expect(f.aiCalls).toHaveLength(0);
  });
  it("GEDCOM handler exports every page and excludes another tree",async()=>{const people=Array.from({length:1203},(_,i)=>({id:`person-${i}`,user_id:owner,arbol_id:tree,nombres:`Nombre${i}`,nac_fecha_aprox:"hacia 1880"}));const f=fixture({personas:[...people,{id:"outsider",user_id:owner,arbol_id:"other",nombres:"Invisible"}]});const response=await f.invoke("familysearch-export",{});expect(response.status).toBe(200);const parsed=parseGedcom(await response.text());expect(parsed.personas).toHaveLength(1203);expect(parsed.personas.every(p=>p.nac_fecha_aprox==="ABT 1880")).toBe(true);});
});
