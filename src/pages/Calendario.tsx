import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Calendar, Cake, Heart, Cross, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Persona = { id: string; nombres: string; apellidos: string; nac_fecha: string | null; defuncion_fecha: string | null; matrimonio_fecha: string | null; viva: string | null };
type Evento = { id: string; persona_id: string; tipo: string; fecha: string | null; descripcion: string | null };

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function diffYears(fechaISO: string) {
  const d = new Date(fechaISO);
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) y--;
  return y;
}

export default function Calendario() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState<number>(new Date().getMonth());

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,nac_fecha,defuncion_fecha,matrimonio_fecha,viva").limit(1000),
        supabase.from("eventos").select("id,persona_id,tipo,fecha,descripcion").not("fecha", "is", null).limit(1000),
      ]);
      setPersonas((p ?? []) as any);
      setEventos((e ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const items = useMemo(() => {
    const out: { fecha: Date; mes: number; dia: number; tipo: string; titulo: string; persona?: Persona; years?: number; icon: any; color: string }[] = [];
    const map = new Map(personas.map(p => [p.id, p]));
    personas.forEach(p => {
      if (p.nac_fecha) {
        const d = new Date(p.nac_fecha);
        out.push({ fecha: d, mes: d.getMonth(), dia: d.getDate(), tipo: "cumpleanos", titulo: `Cumpleaños · ${p.nombres} ${p.apellidos}`, persona: p, years: diffYears(p.nac_fecha), icon: Cake, color: "text-pink-500" });
      }
      if (p.matrimonio_fecha) {
        const d = new Date(p.matrimonio_fecha);
        out.push({ fecha: d, mes: d.getMonth(), dia: d.getDate(), tipo: "matrimonio", titulo: `Aniversario boda · ${p.nombres} ${p.apellidos}`, persona: p, years: diffYears(p.matrimonio_fecha), icon: Heart, color: "text-rose-500" });
      }
      if (p.defuncion_fecha) {
        const d = new Date(p.defuncion_fecha);
        out.push({ fecha: d, mes: d.getMonth(), dia: d.getDate(), tipo: "defuncion", titulo: `Aniversario fallecimiento · ${p.nombres} ${p.apellidos}`, persona: p, years: diffYears(p.defuncion_fecha), icon: Cross, color: "text-slate-500" });
      }
    });
    eventos.forEach(ev => {
      if (!ev.fecha) return;
      const d = new Date(ev.fecha);
      const per = map.get(ev.persona_id);
      out.push({ fecha: d, mes: d.getMonth(), dia: d.getDate(), tipo: ev.tipo, titulo: `${ev.tipo}${per ? " · " + per.nombres + " " + per.apellidos : ""}`, persona: per, icon: Sparkles, color: "text-primary" });
    });
    return out.sort((a, b) => a.dia - b.dia);
  }, [personas, eventos]);

  const delMes = items.filter(i => i.mes === mes);
  const proximos = useMemo(() => {
    const today = new Date();
    const todayDoy = today.getMonth() * 31 + today.getDate();
    return [...items]
      .map(i => ({ ...i, doy: i.mes * 31 + i.dia, delta: ((i.mes * 31 + i.dia) - todayDoy + 372) % 372 }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 30);
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader icon={Calendar} title="Calendario familiar" subtitle="Cumpleaños, aniversarios y eventos de vida" />

      <Tabs defaultValue="mes" className="w-full">
        <TabsList>
          <TabsTrigger value="mes">Por mes</TabsTrigger>
          <TabsTrigger value="proximos">Próximos eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="mes" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {MESES.map((m, idx) => (
              <button key={m} onClick={() => setMes(idx)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${idx === mes ? "bg-primary text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}>
                {m}
              </button>
            ))}
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> :
            delMes.length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos este mes.</p> :
            <ul className="space-y-2">
              {delMes.map((i, k) => (
                <EventoRow key={k} item={i} />
              ))}
            </ul>}
        </TabsContent>

        <TabsContent value="proximos">
          {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> :
            <ul className="space-y-2">
              {proximos.map((i, k) => (
                <EventoRow key={k} item={i} mostrarMes />
              ))}
            </ul>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventoRow({ item, mostrarMes }: { item: any; mostrarMes?: boolean }) {
  const Icon = item.icon;
  const inner = (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-foreground/5">
      <div className={`grid h-10 w-10 place-items-center rounded-full bg-foreground/5 ${item.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{item.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {item.dia}{mostrarMes ? ` · ${MESES[item.mes]}` : ""} {item.years !== undefined ? `· ${item.years} años` : ""}
        </p>
      </div>
    </div>
  );
  return <li>{item.persona ? <Link to={`/personas/${item.persona.id}`}>{inner}</Link> : inner}</li>;
}
