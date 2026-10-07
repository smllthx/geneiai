import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type VitalPerson = Partial<Record<'nac_fecha' | 'nac_fecha_aprox' | 'nac_lugar_id' | 'bautismo_fecha' | 'bautismo_lugar_id' | 'matrimonio_fecha' | 'matrimonio_lugar_id' | 'defuncion_fecha' | 'defuncion_lugar_id' | 'entierro_fecha' | 'entierro_lugar_id' | 'viva', string | null>>;
type VitalEvent = { tipo: string; fecha?: string | null; fecha_aprox?: string | null; lugar_id?: string | null; lugar_original?: string | null };
const facts = [
  ['Nacimiento', 'nacimiento', 'nac_fecha', 'nac_lugar_id'],
  ['Bautismo', 'bautismo', 'bautismo_fecha', 'bautismo_lugar_id'],
  ['Matrimonio', 'matrimonio', 'matrimonio_fecha', 'matrimonio_lugar_id'],
  ['Defunción', 'defuncion', 'defuncion_fecha', 'defuncion_lugar_id'],
  ['Entierro', 'entierro', 'entierro_fecha', 'entierro_lugar_id'],
] as const;
function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function PersonVitalFacts({ person, name, events = [], placeLabel }: { person: VitalPerson; name: string; events?: VitalEvent[]; placeLabel: (id?: string | null) => string | null }) {
  return <Card className="archivo-card mb-4 overflow-hidden">
    <CardHeader className="border-b py-4"><CardTitle className="text-base">Información esencial</CardTitle></CardHeader>
    <CardContent className="p-0"><dl className="grid sm:grid-cols-2">
      <div className="border-b px-5 py-4 sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Nombre</dt><dd className="mt-1 text-lg font-semibold">{name}</dd></div>
      {facts.map(([label, type, dateKey, placeKey]) => {
        // Canonical dates win; imported events supply missing vital information.
        const candidates = events.filter(event => event.tipo.toLowerCase() === type);
        const event = person[dateKey]
          ? candidates.find(event => event.fecha === person[dateKey])
          : candidates.find(event => event.fecha || event.fecha_aprox) ?? candidates[0];
        const date = dateLabel(person[dateKey] || event?.fecha) || (type === 'nacimiento' ? person.nac_fecha_aprox : null) || event?.fecha_aprox || (type === 'defuncion' && person.viva === 'si' ? 'Vive' : null);
        const place = placeLabel(person[placeKey]) || placeLabel(event?.lugar_id) || event?.lugar_original;
        return <div key={type} className="min-w-0 border-b px-5 py-4">
          <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-base font-semibold">{date || (!place && <span className="font-normal text-muted-foreground">Dato no registrado</span>)}</dd>
          {place && <dd className="mt-1 break-words text-sm text-muted-foreground">{place}</dd>}
        </div>;
      })}
    </dl></CardContent>
  </Card>;
}
