import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, it, expect, vi } from "vitest";
import Coincidencias from "./Coincidencias";
import Fusionar from "./Fusionar";
const mocks=vi.hoisted(()=>({people:vi.fn(),invoke:vi.fn(),success:vi.fn(),rows:[] as any[]}));
vi.mock("@/hooks/use-realtime-reload",()=>({usePeopleRevision:()=>0}));
vi.mock("@/lib/peopleData",()=>({getActiveTreeId:async()=>"tree",fetchAllPeople:(...args:any[])=>mocks.people(...args)}));
vi.mock("sonner",()=>({toast:{success:(v:any)=>mocks.success(v),error:vi.fn(),loading:vi.fn(),dismiss:vi.fn()}}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke:(...args:any[])=>mocks.invoke(...args)},from:()=>{let rows=mocks.rows;const q:any={select:()=>q,order:()=>q,range:()=>q,eq:(key:string,value:any)=>{rows=rows.filter(r=>r[key]===value);return q;},then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};return q;}}}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.rows=[];});
it("renders only pairs whose two people are in the active tree, without a false probability",async()=>{
  mocks.people.mockResolvedValue([{id:"a",nombres:"Giovanni",apellidos:"Sanguineti"},{id:"b",nombres:"Juan",apellidos:"Sanguineti"}]);
  mocks.rows=[{id:"one",ref_a:"a",ref_b:"b",score:0,estado:"pendiente",razones:["Variante registrada"]},{id:"other",ref_a:"a",ref_b:"outside",score:100,estado:"pendiente",razones:["Otra familia"]}];
  render(<MemoryRouter><Coincidencias/></MemoryRouter>);
  expect(await screen.findByText("Giovanni Sanguineti")).toBeInTheDocument();
  expect(screen.getByText("Juan Sanguineti")).toBeInTheDocument();expect(screen.queryByText("Otra familia")).not.toBeInTheDocument();expect(screen.queryByText("/100")).not.toBeInTheDocument();
  expect(mocks.people.mock.calls[0][1]).toEqual({treeId:"tree",includeUnscoped:false});
});
it("takes the duplicate detector's actual proposal count to its review page",async()=>{
  mocks.people.mockResolvedValue([]);mocks.invoke.mockResolvedValue({data:{propuestas_creadas:2,review_path:"/sugerencias"},error:null});
  render(<MemoryRouter initialEntries={["/fusionar"]}><Routes><Route path="/fusionar" element={<Fusionar/>}/><Route path="/sugerencias" element={<p>Revisar propuestas guardadas</p>}/></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button",{name:"Detectar duplicados con IA"}));
  expect(await screen.findByText("Revisar propuestas guardadas")).toBeInTheDocument();
  await waitFor(()=>expect(mocks.success).toHaveBeenCalledWith("2 propuestas para comparar"));
});
