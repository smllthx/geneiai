import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import MotorIdentidad from "./MotorIdentidad";
const fixture=vi.hoisted(()=>({writes:[] as any[],filters:[] as any[],note:{id:"n",source_person_id:"a",candidate_person_id:"b",document_id:null,subject_name:"Giovanni Sanguineti",candidate_name:"Juan Sanguineti",source_label:"Fichas del árbol",excerpt:null,reasons:["Coincide una variante registrada."],conflicts:[],score:.98,model_version:"geneai-identidad-1.0.0",status:"pending"}}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"owner"}})}));
vi.mock("@/lib/peopleData",()=>({getActiveTreeId:async()=>"tree"}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:(table:string)=>{
  let single=false,mutation=false;const filter:any={};
  const q:any={select:()=>q,eq:(k:string,v:any)=>{filter[k]=v;return q;},match:(v:any)=>{Object.assign(filter,v);return q;},is:()=>q,order:()=>q,range:()=>q,in:()=>q,returns:()=>q,single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},update:(value:any)=>{mutation=true;fixture.writes.push({table,value});return q;},then:(resolve:any)=>{fixture.filters.push({table,filter});let data:any=[],count=0;if(table==="arboles")data={id:"tree",nombre:"Archivo de prueba"};if(table==="neural_identity_notes"){data=mutation?{id:"n"}:[fixture.note];count=1;}if(table==="personas")data=[{id:"a",nombres:"Giovanni",apellidos:"Sanguineti",nac_fecha:"1865-09-08",defuncion_fecha:"1911-06-06",viva:"no",variantes_nombre:["Juan"]},{id:"b",nombres:"Juan",apellidos:"Sanguineti",nac_fecha:"1865-09-08",defuncion_fecha:"1911-06-06",viva:"no"}];return Promise.resolve({data,error:null,count}).then(resolve);}};return q;
}}}));
it("opens side-by-side evidence and saves only a scoped review decision",async()=>{
  render(<MemoryRouter><MotorIdentidad/></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button",{name:/Giovanni Sanguineti.*Juan Sanguineti/}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Confirmar coincidencia"})).toBeEnabled());
  expect(screen.getAllByText(/45 años/)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Confirmar coincidencia"}));
  await waitFor(()=>expect(fixture.writes).toEqual([{table:"neural_identity_notes",value:{status:"confirmed"}}]));
  expect(fixture.filters.filter(f=>f.table==="neural_identity_notes").every(f=>f.filter.user_id==="owner"&&f.filter.arbol_id==="tree")).toBe(true);
  expect(fixture.filters.some(f=>f.table==="neural_identity_notes"&&f.filter.id==="n"&&f.filter.status==="pending")).toBe(true);
});
