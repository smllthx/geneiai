import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CertezaBadge from "@/components/CertezaBadge";
import { Plus, EyeOff, Sparkles, GitMerge, ListOrdered, Link2, RefreshCw } from "lucide-react";
import { personaCode } from "@/lib/personaCode";
import { toast } from "sonner";
import { suggestSurnameRelationships } from "@/lib/personAutoRules";
import { filterPeopleForQuery } from "@/lib/personSearch";
import { fetchAllPeople, fetchAllRelations, getActiveTreeId, withTreeScope } from "@/lib/peopleData";
import VirtualList from "@/components/VirtualList";

type LinkFilter = "todas" | "en_arbol" | "sin_vincular";
const PEOPLE_LIST_STATE_KEY = "geneai:personas-list-state";

export default function PersonasList() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [q, setQ] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(PEOPLE_LIST_STATE_KEY) || "{}").q || ""; } catch { return ""; }
  });
  const [linkFilter, setLinkFilter] = useState<LinkFilter>(() => {
    try { return JSON.parse(sessionStorage.getItem(PEOPLE_LIST_STATE_KEY) || "{}").linkFilter || "todas"; } catch { return "todas"; }
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [people, rels] = await Promise.all([
        fetchAllPeople<any>("*"),
        fetchAllRelations<any>("persona_id,pariente_id,tipo"),
      ]);
      setPersonas(people);
      setRelaciones(rels);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar todas las personas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    sessionStorage.setItem(PEOPLE_LIST_STATE_KEY, JSON.stringify({ q, linkFilter }));
  }, [q, linkFilter]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      if (personas.length === 0 || document.visibilityState === "visible") load();
    };
    window.addEventListener("pageshow", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);
    window.addEventListener("genaia:data-changed", refreshIfNeeded);
    return () => {
      window.removeEventListener("pageshow", refreshIfNeeded);
      window.removeEventListener("focus", refreshIfNeeded);
      window.removeEventListener("genaia:data-changed", refreshIfNeeded);
    };
  }, [personas.length]);

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    relaciones.forEach((r) => {
      if (r.persona_id) ids.add(r.persona_id);
      if (r.pariente_id) ids.add(r.pariente_id);
    });
    return ids;
  }, [relaciones]);

  const filtered = useMemo(() => {
    const base = personas.filter((p) => {
      if (linkFilter === "en_arbol") return linkedIds.has(p.id);
      if (linkFilter === "sin_vincular") return !linkedIds.has(p.id);
      return true;
    });
    if (!q.trim()) return base;
    return filterPeopleForQuery(base, q, { limit: 5000 });
  }, [personas, q, linkFilter, linkedIds]);

  const generarSugerenciasApellido = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    const activeTreeId = await getActiveTreeId(user.id);
    const existingPairs = new Set(
      relaciones.map((r) => [r.persona_id, r.pariente_id].sort().join(":")),
    );
    const candidates = suggestSurnameRelationships(personas, existingPairs);
    if (!candidates.length) return toast.info("No encontré nuevas relaciones probables por apellido.");
    const rows = candidates.map((s) => withTreeScope({
      user_id: user.id,
      persona_id: s.personA.id,
      tipo: "relacion_por_apellido",
      titulo: `Revisar relación: ${s.personA.nombres} ${s.personA.apellidos} y ${s.personB.nombres} ${s.personB.apellidos}`,
      descripcion: s.reason,
      origen: "reglas_locales",
      confianza: s.confidence,
      payload: {
        person_a: s.personA.id,
        person_b: s.personB.id,
        shared_surname: s.sharedSurname,
        suggested_actions: ["hermano", "padre", "madre", "hijo", "otro"],
      },
    }, activeTreeId));
    const { error } = await supabase.from("sugerencias").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} sugerencia(s) creadas por apellidos`, {
      action: { label: "Ver", onClick: () => navigate("/sugerencias") },
    });
  };

  const renderPersonRow = (p: any) => (
    <div key={p.id}
      className="archivo-card flex min-h-[78px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-primary/40">
      <button onClick={() => navigate(`/personas/${p.id}`)} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-bold text-foreground">{p.nombres}</span>
          <span className="font-bold text-foreground">{p.apellidos}</span>
          <span className="rounded-md border border-border/60 bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground">
            {personaCode(p.id)}
          </span>
          {p.viva === "si" && <span title="Persona viva — privada"><EyeOff className="inline h-3.5 w-3.5 text-muted-foreground" /></span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${linkedIds.has(p.id) ? "bg-emerald-500/12 text-emerald-500" : "bg-amber-500/12 text-amber-500"}`}>
            {linkedIds.has(p.id) ? "en árbol" : "sin vincular"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {p.nac_fecha ? `n. ${new Date(p.nac_fecha).getUTCFullYear()}` : p.nac_rango_ini ? `n. ${p.nac_rango_ini}–${p.nac_rango_fin}` : "nacimiento s/d"}
          {p.defuncion_fecha && ` — †${new Date(p.defuncion_fecha).getUTCFullYear()}`}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          title={`Investigar a ${p.nombres} ${p.apellidos} con IA usando toda su información`}
          onClick={async (e) => {
            e.stopPropagation();
            const t = toast.loading(`IA investigando a ${p.nombres} ${p.apellidos}…`);
            try {
              const { data, error } = await supabase.functions.invoke("busqueda-ia", { body: { modo: "persona", persona_id: p.id } });
              toast.dismiss(t);
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              toast.success(`+${data.hallazgos?.length ?? 0} hallazgo(s) — revísalos en Búsqueda IA`, {
                action: { label: "Ver", onClick: () => navigate("/busqueda-ia") },
              });
            } catch (err: any) { toast.dismiss(t); toast.error(err.message ?? "Error"); }
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> IA
        </Button>
        <CertezaBadge value={p.certeza} />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Personas"
        subtitle="Toda persona del archivo. Cada una con su código único de identificación."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/apellidos")}
              title="Ver personas agrupadas por apellido"
            >
              <ListOrdered className="h-4 w-4" /> Apellidos
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/fusionar")}
              title="Detectar y fusionar personas duplicadas"
            >
              <GitMerge className="h-4 w-4" /> Detectar duplicados
            </Button>
            <Button
              variant="outline"
              onClick={generarSugerenciasApellido}
              title="Sugerir conexiones familiares por apellidos compartidos"
            >
              <Link2 className="h-4 w-4" /> Sugerir relaciones
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </Button>
            <Button onClick={() => navigate("/personas/nueva")}>
              <Plus className="h-4 w-4" /> Nueva persona
            </Button>
          </div>
        }
      />
      <Input
        placeholder="Buscar todas las personas por nombre, apellido, variante, fecha, código o UUID…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {([
          ["todas", "Todas"],
          ["en_arbol", "En árbol"],
          ["sin_vincular", "Sin vincular"],
        ] as [LinkFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setLinkFilter(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              linkFilter === key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-foreground/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-3 text-xs text-muted-foreground">
        Mostrando {filtered.length} de {personas.length} persona(s). Incluye vinculadas al árbol, importadas, sueltas y pendientes.
      </div>
      {loading && personas.length === 0 ? (
        <Card className="archivo-card"><CardContent className="space-y-3 py-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          ))}
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="archivo-card"><CardContent className="py-12 text-center text-muted-foreground">
          Sin resultados. Prueba con otro nombre o código.
        </CardContent></Card>
      ) : (
        filtered.length > 120 ? (
          <VirtualList
            items={filtered}
            itemHeight={88}
            height={Math.min(760, Math.max(420, window.innerHeight - 330))}
            renderItem={renderPersonRow}
          />
        ) : (
          <div className="grid gap-2">
            {filtered.map(renderPersonRow)}
          </div>
        )
      )}
    </div>
  );
}
