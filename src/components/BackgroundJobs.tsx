import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

type Job = {
  id: string;
  tipo: string;
  descripcion: string;
  metadata: any;
  created_at: string;
};

// Muestra una tira flotante en la base de pantalla con los jobs IA en curso
// (lectura de documentos, mega-buscador, etc). Persiste entre rutas.
export default function BackgroundJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("actividad")
      .select("id, tipo, descripcion, metadata, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .or("tipo.like.%inicio%,tipo.like.%lectura_documento%,tipo.like.%mega%,tipo.like.%error%")
      .order("created_at", { ascending: false })
      .limit(10);
    setJobs((data ?? []) as Job[]);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    // Realtime para nuevos jobs
    const ch = supabase
      .channel("actividad-jobs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actividad" }, () => load())
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, []);

  // Filtrar: si hay un "completado" o "error" para un filename, ocultar el "inicio" correspondiente
  const visible = jobs.filter((j) => {
    if (hidden.has(j.id)) return false;
    if (!j.tipo.includes("inicio")) return false;
    const fn = j.metadata?.filename;
    if (!fn) return true;
    const done = jobs.some((o) => o.metadata?.filename === fn && (o.metadata?.estado === "completado" || o.metadata?.estado === "error") && new Date(o.created_at) > new Date(j.created_at));
    return !done;
  }).slice(0, 3);

  // Toast-like para completados recientes
  const recientes = jobs.filter((j) => {
    if (hidden.has(j.id)) return false;
    if (!(j.metadata?.estado === "completado" || j.metadata?.estado === "error")) return false;
    return Date.now() - new Date(j.created_at).getTime() < 60 * 1000;
  }).slice(0, 2);

  if (!visible.length && !recientes.length) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)] flex flex-col gap-2 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
      {visible.map((j) => (
        <Link to="/inicio" key={j.id} className="pointer-events-auto rounded-full bg-card/95 backdrop-blur border border-border shadow-lg px-4 py-2.5 flex items-center gap-2.5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span className="truncate flex-1">{j.descripcion}</span>
        </Link>
      ))}
      {recientes.map((j) => {
        const err = j.metadata?.estado === "error";
        return (
          <button key={j.id} onClick={() => setHidden(new Set([...hidden, j.id]))}
            className="pointer-events-auto rounded-full bg-card/95 backdrop-blur border border-border shadow-lg px-4 py-2.5 flex items-center gap-2.5 text-sm text-left">
            {err ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
            <span className="truncate flex-1">{j.descripcion}</span>
            <Sparkles className="h-3 w-3 opacity-50 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
