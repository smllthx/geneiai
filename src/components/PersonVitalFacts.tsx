import { localizeDateLabel } from "@/lib/language";
import { GeneIcon } from "./GeneIcon";
import CountryFlag from "./CountryFlag";
import { eventType, eventTypes } from "@/lib/timeline";
import { useLanguage } from "@/contexts/LanguageContext";
import { birthLabel, type BirthFields } from "@/lib/personDates";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type VitalPerson = BirthFields & Partial<Record<'nac_fecha' | 'nac_fecha_aprox' | 'nac_lugar_id' | 'bautismo_fecha' | 'bautismo_lugar_id' | 'matrimonio_fecha' | 'matrimonio_lugar_id' | 'defuncion_fecha' | 'defuncion_lugar_id' | 'entierro_fecha' | 'entierro_lugar_id' | 'viva', string | null>>;
type VitalEvent = { tipo: string; fecha?: string | null; fecha_aprox?: string | null; lugar_id?: string | null; lugar_original?: string | null };
const facts = [
  ['Nacimiento', 'nacimiento', 'nac_fecha', 'nac_lugar_id'],
  ['Bautismo', 'bautismo', 'bautismo_fecha', 'bautismo_lugar_id'],
  ['Matrimonio', 'matrimonio', 'matrimonio_fecha', 'matrimonio_lugar_id'],
  ['Defunción', 'defuncion', 'defuncion_fecha', 'defuncion_lugar_id'],
  ['Entierro', 'entierro', 'entierro_fecha', 'entierro_lugar_id'],
] as const;
function dateLabel(value?: string | null, locale = "es-CL") {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function PersonVitalFacts({ person, name, events = [], placeLabel }: { person: VitalPerson; name: string; events?: VitalEvent[]; placeLabel: (id?: string | null) => string | null }) {
  const { t, language, locale } = useLanguage();
  return <Card className="archivo-card mb-4 overflow-hidden">
    <CardHeader className="border-b py-4"><CardTitle className="text-base">{t("Información esencial")}</CardTitle></CardHeader>
    <CardContent className="p-0"><dl className="grid sm:grid-cols-2">
      <div className="border-b px-5 py-4 sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">{t("Nombre")}</dt><dd className="mt-1 text-lg font-semibold">{name}</dd></div>
      {facts.map(([label, type, dateKey, placeKey]) => {
        // Canonical dates win; imported events supply missing vital information.
        const candidates = events.filter(event => eventType(event.tipo) === type);
        const event = person[dateKey]
          ? candidates.find(event => event.fecha === person[dateKey])
          : candidates.find(event => event.fecha || event.fecha_aprox) ?? candidates[0];
        const date = (type === 'nacimiento' ? (person.nac_fecha ? dateLabel(person.nac_fecha, locale) : localizeDateLabel(birthLabel(person), language)) : dateLabel(person[dateKey], locale)) || dateLabel(event?.fecha, locale) || event?.fecha_aprox || (type === 'defuncion' && person.viva === 'si' ? t('Vive') : null);
        const place = placeLabel(person[placeKey]) || placeLabel(event?.lugar_id) || event?.lugar_original;
        return <div key={type} className="min-w-0 border-b px-5 py-4">
          <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><GeneIcon name={eventTypes[type].icon} size={21} />{t(label)}</dt>
          <dd className="mt-1 text-base font-semibold">{date || (!place && <span className="font-normal text-muted-foreground">{t("Dato no registrado")}</span>)}</dd>
          {place && <dd className="mt-1 flex items-center gap-2 break-words text-sm text-muted-foreground"><CountryFlag country={place} decorative /><span>{place}</span></dd>}
        </div>;
      })}
    </dl></CardContent>
  </Card>;
}
