import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, StatPill, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import {
  Plus, FileText, Search, Sparkles, Users, GitBranch, Compass, Image as ImageIcon, Dna,
} from "lucide-react";

export default function Inicio() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    personas: 0, lugares: 0, fotos: 0,
    docsPendientes: 0, coincidencias: 0, hipotesis: 0, inferencias: 0, apellidos: [] as string[],
  });
  const [actividad, setActividad] = useState<any[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, l, f, d, c, h, i, r, a] = await Promise.all([
        supabase.from("personas").select("apellidos", { count: "exact" }),
        supabase.from("lugares").select("id", { count: "exact", head: true }),
        supabase.from("fotos").select("id", { count: "exact", head: true }),
        supabase.from("documentos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("coincidencias").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("hipotesis").select("id", { count: "exact", head: true }).eq("estado", "abierta"),
        supabase.from("generated_inferences").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("personas").select("id,nombres,apellidos,updated_at").order("updated_at", { ascending: false }).limit(8),
        supabase.from("actividad").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      const ap = new Map<string, number>();
      (p.data ?? []).forEach((row) => {
        const x = row.apellidos?.split(/\s+/)[0]; if (!x) return;
        ap.set(x, (ap.get(x) ?? 0) + 1);
      });
      setStats({
        personas: p.count ?? 0, lugares: l.count ?? 0, fotos: f.count ?? 0,
        docsPendientes: d.count ?? 0, coincidencias: c.count ?? 0,
        hipotesis: h.count ?? 0, inferencias: i.count ?? 0,
        apellidos: [...ap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x),
      });
      setRecientes(r.data ?? []); setActividad(a.data ?? []);
    })();
  }, []);

  const QuickAction = ({ icon: Icon, label, to }: any) => (
    <Link to={to} className="glass flex flex-col items-start gap-2 rounded-2xl p-4 transition-all hover:scale-[1.02] hover:shadow-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Tu archivo familiar"
        title="Inicio"
        subtitle="Una mirada general al ecosistema familiar: lo registrado, lo nuevo y lo que falta investigar."
        actions={<>
          <Button onClick={() => navigate("/personas/nueva")}><Plus className="h-4 w-4" /> Nueva persona</Button>
          <Button variant="outline" onClick={() => navigate("/buscar")}><Search className="h-4 w-4" /> Buscar</Button>
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill label="Personas" value={stats.personas} />
        <StatPill label="Fotos" value={stats.fotos} />
        <StatPill label="Lugares" value={stats.lugares} />
        <StatPill label="Coincidencias" value={stats.coincidencias} hint="por revisar" />
        <StatPill label="Documentos" value={stats.docsPendientes} hint="pendientes" />
        <StatPill label="Hipótesis" value={stats.hipotesis} hint="abiertas" />
        <StatPill label="Inferencias" value={stats.inferencias} hint="por revisar" />
        <StatPill label="Apellidos" value={stats.apellidos.length} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction icon={GitBranch} label="Ver árbol" to="/arbol" />
        <QuickAction icon={Sparkles} label="Investigar" to="/investigacion" />
        <QuickAction icon={Compass} label="Coincidencias" to="/coincidencias" />
        <QuickAction icon={ImageIcon} label="Fotos" to="/fotos" />
        <QuickAction icon={FileText} label="Documentos" to="/documentos" />
        <QuickAction icon={Dna} label="ADN / Origen" to="/adn" />
        <QuickAction icon={Users} label="Personas" to="/personas" />
        <QuickAction icon={Plus} label="Importar / Exportar" to="/importar" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <h2 className="mb-3 font-display text-lg font-semibold">Actividad reciente</h2>
          {actividad.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún sin actividad. Empieza creando una persona o importando un GEDCOM.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {actividad.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <div>{a.descripcion}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("es")}</div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-display text-lg font-semibold">Personas editadas recientemente</h2>
          {recientes.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="Sin personas" description="Crea tu primera persona para empezar tu árbol."
              action={<Button size="sm" onClick={() => navigate("/personas/nueva")}>Crear persona</Button>} />
          ) : (
            <ul className="divide-y divide-border/50">
              {recientes.map((p) => (
                <li key={p.id}>
                  <button className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-accent" onClick={() => navigate(`/personas/${p.id}`)}>
                    <Users className="h-4 w-4 text-muted-foreground" /> {p.nombres} {p.apellidos}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="md:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Apellidos principales</h2>
          {stats.apellidos.length === 0
            ? <p className="text-sm text-muted-foreground">Aún sin apellidos registrados.</p>
            : <div className="flex flex-wrap gap-2">{stats.apellidos.map((a) => <span key={a} className="glass-pill">{a}</span>)}</div>}
        </GlassCard>
      </div>
    </div>
  );
}
