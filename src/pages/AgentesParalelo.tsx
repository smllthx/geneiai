import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Play, Loader2, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notifications";

type Provider = "gemini";
type Status = "queued" | "running" | "done" | "error" | "cancelled";

interface Task {
  titulo: string;
  prompt: string;
  provider: Provider;
  modelo: string;
}

interface Run {
  id: string;
  titulo: string;
  prompt: string;
  provider: Provider;
  modelo: string;
  status: Status;
  resultado: string | null;
  error: string | null;
  duracion_ms: number | null;
  created_at: string;
}

const MODELS: Record<Provider, string[]> = {
  gemini: ["openai/gpt-4o-mini", "openai/gpt-4o"],
};

const newTask = (): Task => ({
  titulo: "Nueva tarea",
  prompt: "",
  provider: "gemini",
  modelo: MODELS.gemini[0],
});

export default function AgentesParalelo() {
  const [tasks, setTasks] = useState<Task[]>([newTask()]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState({ total: 0, done: 0, ok: 0 });

  const loadRuns = async () => {
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setRuns((data as Run[]) ?? []);
  };

  useEffect(() => {
    loadRuns();
    const ch = supabase
      .channel("agent_runs_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => loadRuns())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateTask = (i: number, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };

  const launchAll = async () => {
    const valid = tasks.filter((t) => t.prompt.trim().length > 0);
    if (valid.length === 0) { toast.error("Agregá al menos una tarea con prompt"); return; }
    setLaunching(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("No autenticado");

      const inserts = valid.map((t) => ({
        user_id,
        titulo: t.titulo || "Tarea",
        prompt: t.prompt,
        provider: t.provider,
        modelo: t.modelo,
        status: "queued" as Status,
      }));
      const { data: created, error } = await supabase.from("agent_runs").insert(inserts).select("id");
      if (error) throw error;
      await supabase.from("research_tasks").insert(valid.map((t) => ({
        user_id,
        tipo: "otro" as const,
        descripcion: `Agente paralelo: ${t.titulo || "Tarea"} — ${t.prompt.slice(0, 180)}`,
      })));

      setProgress({ total: created?.length ?? valid.length, done: 0, ok: 0 });
      const results = await Promise.allSettled((created ?? []).map(async (r) => {
        try {
          const res = await supabase.functions.invoke("run-agent", { body: { runId: r.id } });
          if (res.error) throw res.error;
          setProgress((p) => ({ ...p, ok: p.ok + 1 }));
          return res;
        } finally {
          setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) }));
        }
      }));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      toast.success(`${ok}/${valid.length} agentes completados en paralelo`);
      notify("Agentes en paralelo", { body: `${ok}/${valid.length} tareas completadas; revisa resultados y tareas enlazadas.`, url: "/investigacion?tab=paralelo" });
      setTasks([newTask()]);
    } catch (e: any) {
      toast.error(e.message ?? "Error al lanzar agentes");
    } finally {
      setLaunching(false);
    }
  };

  const StatusBadge = ({ s }: { s: Status }) => {
    const map: Record<Status, { icon: any; label: string; cls: string }> = {
      queued: { icon: Loader2, label: "En cola", cls: "text-muted-foreground" },
      running: { icon: Loader2, label: "Procesando", cls: "text-primary" },
      done: { icon: CheckCircle2, label: "Listo", cls: "text-green-600 dark:text-green-400" },
      error: { icon: AlertCircle, label: "Error", cls: "text-destructive" },
      cancelled: { icon: AlertCircle, label: "Cancelado", cls: "text-muted-foreground" },
    };
    const { icon: I, label, cls } = map[s];
    return (
      <span className={`glass-pill ${cls}`}>
        <I className={`h-3 w-3 ${s === "queued" || s === "running" ? "animate-spin" : ""}`} /> {label}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6" />
          <h1 className="font-display text-3xl font-bold tracking-tight">Agentes en paralelo</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Lanzá varios agentes de <span className="text-gradient font-semibold">ChatGPT/OpenAI</span> al mismo tiempo, cada uno con una tarea distinta. Los resultados, avisos y tareas enlazadas aparecen acá en vivo.
        </p>
      </div>

      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Tareas a lanzar</h2>
          <Button variant="ghost" size="sm" onClick={() => setTasks((p) => [...p, newTask()])}>
            <Plus className="h-4 w-4" /> Agregar tarea
          </Button>
        </div>

        <div className="space-y-3">
          {tasks.map((t, i) => (
            <div key={i} className="glass rounded-2xl p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_220px_auto] md:items-center">
                <input
                  className="glass-input"
                  placeholder="Título de la tarea"
                  value={t.titulo}
                  onChange={(e) => updateTask(i, { titulo: e.target.value })}
                />
                <select
                  className="glass-input"
                  value={t.modelo}
                  onChange={(e) => updateTask(i, { modelo: e.target.value })}
                >
                  {MODELS[t.provider].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTasks((p) => p.filter((_, j) => j !== i))}
                  disabled={tasks.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                className="glass-input mt-2 min-h-[80px] w-full"
                placeholder="¿Qué tiene que hacer este agente? Ej: Investigar a Pedro Sanguineti, nacido c.1820 en Liguria, posibles registros parroquiales y lista de pasajeros."
                value={t.prompt}
                onChange={(e) => updateTask(i, { prompt: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={launchAll} disabled={launching} className="rounded-xl">
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Lanzar {tasks.length} {tasks.length === 1 ? "agente" : "agentes"} en paralelo
          </Button>
        </div>
        {progress.total > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Progreso</span>
              <span className="text-xs text-muted-foreground">{progress.done}/{progress.total} · {progress.ok} correctos</span>
            </div>
            <Progress value={(progress.done / progress.total) * 100} className="h-2" />
            <Link to="/investigacion?tab=pistas" className="mt-2 inline-block text-xs text-link underline">Ver tareas y pistas enlazadas</Link>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Ejecuciones recientes</h2>
        {runs.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Todavía no lanzaste agentes. Cuando lo hagas, los verás acá actualizándose en vivo.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {runs.map((r) => (
              <div key={r.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.provider} · {r.modelo}
                      {r.duracion_ms ? ` · ${(r.duracion_ms / 1000).toFixed(1)}s` : ""}
                    </p>
                  </div>
                  <StatusBadge s={r.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{r.prompt}</p>
                {r.resultado && (
                  <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-foreground/5 p-3 text-sm">
                    {r.resultado}
                  </div>
                )}
                {r.error && (
                  <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
