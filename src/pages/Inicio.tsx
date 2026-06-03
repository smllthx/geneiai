import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, StatPill, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import MigrationMap from "@/components/MigrationMap";
import FamilyTimeline from "@/components/FamilyTimeline";
import PersonaName from "@/components/PersonaName";
import { getRecent } from "@/lib/recent";
import {
  Plus, FileText, Search, Sparkles, Users, GitBranch, Compass, Image as ImageIcon, Dna, MapPin, Clock, UserX, ImageOff, History, ChevronRight,
} from "lucide-react";

export default function Inicio() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    personas: 0, lugares: 0, fotos: 0,
    docsPendientes: 0, coincidencias: 0, hipotesis: 0, inferencias: 0, apellidos: [] as string[],
  });
  const [actividad, setActividad] = useState<any[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [vistasRecientes, setVistasRecientes] = useState<any[]>([]);
  const [sinPadres, setSinPadres] = useState<any[]>([]);
  const [sinFotos, setSinFotos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, l, f, d, c, h, i, r, a, allPersonas, allRels, fotos] = await Promise.all([
        supabase.from("personas").select("apellidos", { count: "exact" }),
        supabase.from("lugares").select("id", { count: "exact", head: true }),
        supabase.from("fotos").select("id", { count: "exact", head: true }),
        supabase.from("documentos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("coincidencias").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("hipotesis").select("id", { count: "exact", head: true }).eq("estado", "abierta"),
        supabase.from("generated_inferences").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("personas").select("id,nombres,apellidos,foto_url,updated_at").order("updated_at", { ascending: false }).limit(8),
        supabase.from("actividad").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("personas").select("id,nombres,apellidos,foto_url"),
        supabase.from("relaciones").select("persona_id,tipo"),
        supabase.from("fotos").select("personas_ids"),
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

      // Personas sin padres
      const conPadres = new Set(
        (allRels.data ?? [])
          .filter((rl: any) => rl.tipo === "padre" || rl.tipo === "madre")
          .map((rl: any) => rl.persona_id)
      );
      setSinPadres((allPersonas.data ?? []).filter((per: any) => !conPadres.has(per.id)).slice(0, 6));

      // Personas sin fotos
      const conFotos = new Set<string>();
      (fotos.data ?? []).forEach((fr: any) => (fr.personas_ids ?? []).forEach((id: string) => conFotos.add(id)));
      setSinFotos((allPersonas.data ?? []).filter((per: any) => !per.foto_url && !conFotos.has(per.id)).slice(0, 6));

      // Vistas recientes (localStorage)
      const recentEntries = getRecent();
      const recentIds = recentEntries.map((r) => r.id);
      if (recentIds.length) {
        const map = new Map((allPersonas.data ?? []).map((x: any) => [x.id, x]));
        setVistasRecientes(recentIds.map((rid) => map.get(rid)).filter(Boolean).slice(0, 8));
        const editedIds = recentEntries.filter((r) => r.action === "edited").map((r) => r.id);
        if (editedIds.length) {
          const edited = editedIds.map((rid) => map.get(rid)).filter(Boolean).slice(0, 8);
          if (edited.length) setRecientes(edited);
        }
      }
    })();

    const onChange = () => {
      const recentIds = getRecent().map((r) => r.id);
      setVistasRecientes((prev) => {
        const byId = new Map(prev.map((x: any) => [x.id, x]));
        return recentIds.map((rid) => byId.get(rid)).filter(Boolean);
      });
    };
    window.addEventListener("genaia:recent-changed", onChange);
    return () => window.removeEventListener("genaia:recent-changed", onChange);
  }, []);

  const QuickAction = ({ icon: Icon, label, to }: any) => (
    <Link to={to} className="glass flex flex-col items-start gap-2 rounded-2xl p-4 transition-all hover:shadow-xl">
      <div className="genealogy-symbol h-10 w-10 rounded-xl"><Icon className="h-5 w-5" /></div>
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

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Asistente de investigación IA</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">Prioridades inteligentes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {stats.docsPendientes + stats.coincidencias + stats.hipotesis + stats.inferencias} elemento(s) esperando revisión entre documentos, coincidencias, hipótesis e inferencias.
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <button onClick={() => navigate("/investigacion?tab=insights")} className="rounded-2xl border p-3 text-left hover:bg-foreground/5">
              <p className="font-medium">Revisar contradicciones e insights</p>
              <p className="text-xs text-muted-foreground">Detecta problemas, huecos y oportunidades.</p>
            </button>
            <button onClick={() => navigate("/investigacion?tab=hub")} className="rounded-2xl border p-3 text-left hover:bg-foreground/5">
              <p className="font-medium">Buscar antepasado</p>
              <p className="text-xs text-muted-foreground">Registros, texto, imágenes, catálogo y más.</p>
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Buscar antepasado</p>
          <div className="mt-3 grid gap-2">
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Nombres" />
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Apellidos" />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Lugar" />
              <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Año" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/buscar")}><Search className="h-4 w-4" /> Buscar</Button>
              <Button className="flex-1" onClick={() => navigate("/investigacion?tab=busqueda")}><Sparkles className="h-4 w-4" /> IA</Button>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* HERO árbol genealógico — protagonista visual */}
      <Link
        to="/arbol"
        className="genealogy-visual-band group relative mb-6 block overflow-hidden rounded-3xl ring-1 ring-border/40 shadow-xl transition-all hover:shadow-2xl"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(var(--genealogy-route)/0.28), transparent 55%), radial-gradient(100% 90% at 100% 100%, hsl(var(--genealogy-record)/0.26), transparent 60%), linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div className="relative z-10 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Tu legado</p>
            <h2 className="font-display text-2xl font-semibold leading-tight md:text-4xl">
              Árbol genealógico
            </h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              {stats.personas} personas · {stats.apellidos.length} apellidos · explora generaciones, ramas y migraciones de tu familia.
            </p>
            <div className="migration-route-accent mt-3 h-0.5 w-44 opacity-80" />
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/25">
                <GitBranch className="h-3 w-3" /> Abrir árbol
              </span>
              <Link to="/personas/nueva" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium hover:bg-foreground/20">
                <Plus className="h-3 w-3" /> Añadir persona
              </Link>
            </div>
          </div>

          {/* Mini árbol decorativo */}
          <div className="relative h-32 w-full shrink-0 md:h-40 md:w-80">
            <svg viewBox="0 0 320 160" className="h-full w-full" fill="none">
              <defs>
                <linearGradient id="branch" x1="0" x2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {/* ramas */}
              <path d="M160 150 L160 95 M160 95 L70 50 M160 95 L250 50 M70 50 L30 15 M70 50 L110 15 M250 50 L210 15 M250 50 L290 15" stroke="url(#branch)" strokeWidth="2" strokeLinecap="round" />
              {/* nodos */}
              {[
                [160, 150, 9], [160, 95, 7], [70, 50, 6], [250, 50, 6],
                [30, 15, 4], [110, 15, 4], [210, 15, 4], [290, 15, 4],
              ].map(([cx, cy, r], i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill="hsl(var(--primary))" className="opacity-90 transition-all group-hover:opacity-100" />
              ))}
            </svg>
          </div>
        </div>
      </Link>

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

      {/* Vistas recientes */}
      {vistasRecientes.length > 0 && (
        <GlassCard className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <History className="h-4 w-4 text-primary" /> Vistas recientes
            </h2>
            <Link to="/personas" className="text-xs text-link hover:underline">Ver todas →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {vistasRecientes.map((x) => (
              <Link
                key={x.id}
                to={`/personas/${x.id}`}
                className="group flex w-32 shrink-0 flex-col items-center gap-2 rounded-2xl bg-foreground/5 p-3 transition-all hover:bg-foreground/10"
              >
                {x.foto_url ? (
                  <img src={x.foto_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-border/40 group-hover:ring-primary/50" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/10">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="w-full text-center text-xs font-bold leading-tight">
                  {x.nombres} <br /> {x.apellidos}
                </div>
              </Link>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Mapa migratorio (ancho completo) */}
      <Link to="/lugares" className="mb-4 block">
        <GlassCard className="transition-all hover:bg-foreground/[0.02]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <MapPin className="h-4 w-4 text-primary" /> Mapa migratorio familiar
            </h2>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <MigrationMap height={320} />
          <p className="mt-2 text-xs text-muted-foreground">
            Puntos por lugar de nacimiento y defunción · líneas indican migraciones individuales.
          </p>
        </GlassCard>
      </Link>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <GlassCard>
          <Link to="/linea-de-tiempo" className="mb-3 flex items-center justify-between hover:text-primary">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Clock className="h-4 w-4 text-primary" /> Timeline familiar
            </h2>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="max-h-[420px] overflow-y-auto pr-2">
            <FamilyTimeline />
          </div>
        </GlassCard>

        <div className="grid gap-4">
          <GlassCard>
            <Link to="/personas" className="mb-3 flex items-center justify-between hover:text-primary">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <UserX className="h-4 w-4 text-accent" /> Personas sin padres registrados
              </h2>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {sinPadres.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas las personas tienen al menos un padre/madre conectado.</p>
            ) : (
              <ul className="space-y-1.5">
                {sinPadres.map((x) => (
                  <li key={x.id}>
                    <PersonaName persona={x} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard>
            <Link to="/fotos" className="mb-3 flex items-center justify-between hover:text-primary">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <ImageOff className="h-4 w-4 text-accent" /> Personas sin fotos
              </h2>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {sinFotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas las personas tienen al menos una foto.</p>
            ) : (
              <ul className="space-y-1.5">
                {sinFotos.map((x) => (
                  <li key={x.id}>
                    <PersonaName persona={x} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
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
                <li key={p.id} className="py-2">
                  <Link to={`/personas/${p.id}`} className="flex items-center gap-2 hover:opacity-80">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <PersonaName persona={p} size="sm" asLink={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="md:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Apellidos principales</h2>
          {stats.apellidos.length === 0
            ? <p className="text-sm text-muted-foreground">Aún sin apellidos registrados.</p>
            : <div className="flex flex-wrap gap-2">{stats.apellidos.map((a) => <Link key={a} to={`/buscar?q=${encodeURIComponent(a)}`} className="glass-pill font-bold transition-colors hover:bg-primary/10 hover:text-primary">{a}</Link>)}</div>}
        </GlassCard>
      </div>
    </div>
  );
}
