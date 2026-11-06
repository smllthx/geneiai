import { useMemo, useState } from 'react';
import { familyLayers } from '@/lib/treeRendering';
import { PersonCard, EmptySlot, type PersonaLite } from '@/components/PersonCard';
import FamilyDiagram from './FamilyDiagram';
import TreeCanvas from './TreeCanvas';
import { createTreeViewport } from './treeViewport';
import GenerationControl from './GenerationControl';
import '@/pages/tree-page.css';

// Fictional, deliberately uneven branches. No account or database is queried.
const people: PersonaLite[] = [
  { id: 'elena', nombres: 'Elena', apellidos: 'Ríos Martínez', sexo: 'femenino', nac_fecha: '1965-09-08' },
  { id: 'father', nombres: 'Antonio Rafael', apellidos: 'Ríos Costa', sexo: 'masculino' },
  { id: 'mother', nombres: 'Isabel', apellidos: 'Martínez Soto', sexo: 'femenino' },
  { id: 'gf', nombres: 'Rafael', apellidos: 'Ríos Fernández', sexo: 'masculino' },
  { id: 'gm', nombres: 'Mariana Beatriz', apellidos: 'Costa Herrera', sexo: 'femenino' },
  { id: 'mm', nombres: 'Luisa', apellidos: 'Soto', sexo: 'femenino' },
  { id: 'ggf', nombres: 'Gabriel', apellidos: 'Ríos', sexo: 'masculino' },
  { id: 'ggm', nombres: 'Catalina', apellidos: 'Fernández', sexo: 'femenino' },
  { id: 'spouse', nombres: 'Daniel', apellidos: 'Vega', sexo: 'masculino' },
  { id: 'daughter', nombres: 'Lucía', apellidos: 'Vega Ríos', sexo: 'femenino' },
  { id: 'son', nombres: 'Tomás', apellidos: 'Vega Ríos', sexo: 'masculino' },
];
const byId = new Map(people.map(person => [person.id, person]));
const parents: Record<string, (string | null)[]> = { elena: ['father', 'mother'], father: ['gf', 'gm'], mother: [null, 'mm'], gf: ['ggf', 'ggm'] };
const children: Record<string, string[]> = { elena: ['daughter', 'son'] };

export default function TreeDesignPreview() {
  const [generations, setGenerations] = useState(4);
  const [viewport] = useState(createTreeViewport);
  const [selected, setSelected] = useState<PersonaLite | null>(null);
  const ancestors = useMemo(() => familyLayers('elena', generations, id => parents[id] ?? [])[0][0], [generations]);
  const descendants = useMemo(() => familyLayers('elena', generations, id => children[id] ?? [])[0][0], [generations]);
  return <div className="flex h-[calc(100dvh-12rem)] min-h-[580px] flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Árbol genealógico</h1><p className="text-xs text-muted-foreground">Familia ficticia · ramas de distinta profundidad</p></div>
      <div className="max-w-xs"><GenerationControl value={generations} onChange={setGenerations} /></div>
    </div>
    <TreeCanvas viewport={viewport} resetKey={`example:${generations}`}>
      <FamilyDiagram ancestors={ancestors} descendants={descendants}
        renderPerson={(id, kind) => <div className="flex w-max items-center gap-3">
          <PersonCard compact p={byId.get(id)!} highlighted={kind === 'center'} onClick={() => setSelected(byId.get(id)!)} />
          {kind === 'center' && <PersonCard compact p={byId.get('spouse')!} onClick={() => setSelected(byId.get('spouse')!)} />}
        </div>}
        renderMissing={(_id, side) => <EmptySlot label={side === 0 ? 'padre' : 'madre'} onClick={() => {}} />}
      />
    </TreeCanvas>
    {selected && <p role="status" className="text-sm">{selected.nombres} {selected.apellidos} · Persona de ejemplo</p>}
  </div>;
}
