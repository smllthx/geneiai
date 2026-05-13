import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function Buscar() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ personas: any[]; documentos: any[]; eventos: any[]; hipotesis: any[]; lugares: any[] }>({ personas: [], documentos: [], eventos: [], hipotesis: [], lugares: [] });

  useEffect(() => {
    if (!q || q.length < 2) { setData({ personas: [], documentos: [], eventos: [], hipotesis: [], lugares: [] }); return; }
    const t = setTimeout(async () => {
      const term = `%${q}%`;
      const [p, d, e, h, l] = await Promise.all([
        supabase.from("personas").select("*").or(`nombres.ilike.${term},apellidos.ilike.${term},notas.ilike.${term}`),
        supabase.from("documentos").select("*").or(`titulo.ilike.${term},transcripcion.ilike.${term},resumen.ilike.${term}`),
        supabase.from("eventos").select("*").or(`descripcion.ilike.${term},lugar_original.ilike.${term}`),
        supabase.from("hipotesis").select("*").or(`titulo.ilike.${term},descripcion.ilike.${term}`),
        supabase.from("lugares").select("*").or(`ciudad.ilike.${term},provincia.ilike.${term},region.ilike.${term},pais.ilike.${term}`),
      ]);
      setData({ personas: p.data ?? [], documentos: d.data ?? [], eventos: e.data ?? [], hipotesis: h.data ?? [], lugares: l.data ?? [] });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const Section = ({ title, items, render }: any) => (
    items.length === 0 ? null :
    <div className="mb-6">
      <h2 className="font-serif text-xl mb-2">{title} <span className="text-sm text-muted-foreground">({items.length})</span></h2>
      <div className="grid gap-2">{items.map(render)}</div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Buscar en el archivo" subtitle="Búsqueda global en personas, documentos, transcripciones, eventos, hipótesis y lugares." />
      <Input autoFocus placeholder="nombres, apellidos, lugares, palabras dentro de transcripciones…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-6 max-w-xl" />

      <Section title="Personas" items={data.personas} render={(p: any) =>
        <Link key={p.id} to={`/personas/${p.id}`}><Card className="archivo-card hover:border-primary/40"><CardContent className="py-3 text-sm">{p.nombres} {p.apellidos}</CardContent></Card></Link>} />
      <Section title="Documentos" items={data.documentos} render={(d: any) =>
        <Card key={d.id} className="archivo-card"><CardContent className="py-3 text-sm">{d.titulo} <span className="text-muted-foreground">— {d.tipo}</span></CardContent></Card>} />
      <Section title="Eventos" items={data.eventos} render={(e: any) =>
        <Card key={e.id} className="archivo-card"><CardContent className="py-3 text-sm capitalize">{e.tipo}: {e.descripcion ?? e.lugar_original}</CardContent></Card>} />
      <Section title="Hipótesis" items={data.hipotesis} render={(h: any) =>
        <Card key={h.id} className="archivo-card"><CardContent className="py-3 text-sm">{h.titulo}</CardContent></Card>} />
      <Section title="Lugares" items={data.lugares} render={(l: any) =>
        <Card key={l.id} className="archivo-card"><CardContent className="py-3 text-sm">{[l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ")}</CardContent></Card>} />

      {q.length >= 2 && Object.values(data).every((v: any) => v.length === 0) && <p className="text-muted-foreground">Sin resultados.</p>}
    </div>
  );
}
