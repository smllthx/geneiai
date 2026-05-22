import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Sparkles, FileText, Lightbulb, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requestNotificationPermission, notificationPermission, subscribeToPush } from "@/lib/notifications";
import { toast } from "sonner";

export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const [sugs, setSugs] = useState<any[]>([]);
  const [infs, setInfs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [perm, setPerm] = useState<NotificationPermission>("default");

  const load = async () => {
    const [{ data: n }, { data: s }, { data: i }, { data: t }] = await Promise.all([
      supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("sugerencias").select("*").eq("estado", "pendiente").order("confianza", { ascending: false }).limit(30),
      supabase.from("generated_inferences").select("*").eq("status", "pending").order("confidence_score", { ascending: false }).limit(20),
      supabase.from("research_tasks").select("*").eq("estado", "pendiente").order("created_at", { ascending: false }).limit(30),
    ]);
    setItems(n ?? []); setSugs(s ?? []); setInfs(i ?? []); setTasks(t ?? []);
  };

  useEffect(() => {
    let active = true;
    setPerm(notificationPermission());
    load();
    const channelId = `notif-center-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones" }, () => active && load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sugerencias" }, () => active && load())
      .on("postgres_changes", { event: "*", schema: "public", table: "generated_inferences" }, () => active && load())
      .on("postgres_changes", { event: "*", schema: "public", table: "research_tasks" }, () => active && load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const noLeidas = items.filter((i) => !i.leida).length;
  const total = noLeidas + sugs.length + infs.length + tasks.length;
  const marcarTodas = async () => {
    await supabase.from("notificaciones").update({ leida: true }).eq("leida", false);
    load();
  };
  const pedirPermiso = async () => {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      try {
        const { data } = await supabase.functions.invoke("vapid-public");
        const key = (data as any)?.key;
        if (key) {
          const ok = await subscribeToPush(key);
          if (ok) toast.success("Avisos push activados en este dispositivo");
        }
      } catch (e: any) {
        toast.error("No se pudo activar push: " + (e?.message ?? e));
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{total}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[calc(100vw-1rem)] p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Centro de avisos</span>
          {noLeidas > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={marcarTodas}>
              <Check className="mr-1 h-3 w-3" /> Marcar leídas
            </Button>
          )}
        </div>
        {perm !== "granted" && (
          <div className="border-b bg-foreground/5 px-3 py-2 text-xs">
            <p className="mb-1.5">Activa avisos en este dispositivo.</p>
            <Button size="sm" className="h-7 text-xs" onClick={pedirPermiso}>Permitir notificaciones</Button>
          </div>
        )}
        <Tabs defaultValue="notif" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-transparent">
            <TabsTrigger value="notif" className="text-[11px]">
              <FileText className="mr-1 h-3 w-3" /> Avisos {noLeidas > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{noLeidas}</span>}
            </TabsTrigger>
            <TabsTrigger value="sug" className="text-[11px]">
              <Sparkles className="mr-1 h-3 w-3" /> Sug. {sugs.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px]">{sugs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="pred" className="text-[11px]">
              <Lightbulb className="mr-1 h-3 w-3" /> Pred. {infs.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px]">{infs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="task" className="text-[11px]">
              <ListChecks className="mr-1 h-3 w-3" /> Tareas {tasks.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px]">{tasks.length}</span>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notif" className="mt-0 max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin notificaciones.</p>
            ) : items.map((n) => (
              <Link key={n.id} to={n.url ?? "#"} className={`block border-b px-3 py-2 text-sm hover:bg-foreground/5 ${!n.leida ? "bg-primary/5" : ""}`}>
                <p className="font-medium">{n.titulo}</p>
                {n.mensaje && <p className="text-xs text-muted-foreground">{n.mensaje}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("es")}</p>
              </Link>
            ))}
          </TabsContent>
          <TabsContent value="sug" className="mt-0 max-h-80 overflow-y-auto">
            {sugs.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin sugerencias pendientes. Pulsa "Investigar con IA" en una persona.</p>
            ) : sugs.map((s) => (
              <Link key={s.id} to={s.persona_id ? `/personas/${s.persona_id}` : "/asistente"} className="block border-b px-3 py-2 text-sm hover:bg-foreground/5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{s.titulo}</p>
                  <span className="shrink-0 rounded-full bg-accent/30 px-1.5 text-[10px]">{s.confianza}%</span>
                </div>
                {s.descripcion && <p className="text-xs text-muted-foreground">{s.descripcion}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{s.tipo} · {s.origen ?? "ia"}</p>
              </Link>
            ))}
          </TabsContent>
          <TabsContent value="pred" className="mt-0 max-h-80 overflow-y-auto">
            {infs.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin predicciones aún. Genera inferencias desde una persona.</p>
            ) : infs.map((i) => (
              <Link key={i.id} to={i.person_id ? `/personas/${i.person_id}` : "/inferencias"} className="block border-b px-3 py-2 text-sm hover:bg-foreground/5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{i.inferred_field}: {i.inferred_value}</p>
                  <span className="shrink-0 rounded-full bg-accent/30 px-1.5 text-[10px]">{i.confidence_score}%</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{i.explanation}</p>
              </Link>
            ))}
          </TabsContent>
          <TabsContent value="task" className="mt-0 max-h-80 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No hay tareas pendientes.</p>
            ) : tasks.map((t) => (
              <Link key={t.id} to={t.person_id ? `/personas/${t.person_id}` : "/investigacion"} className="block border-b px-3 py-2 text-sm hover:bg-foreground/5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium capitalize">{t.tipo}</p>
                  <span className="shrink-0 rounded-full bg-accent/30 px-1.5 text-[10px]">{t.estado}</span>
                </div>
                {t.descripcion && <p className="text-xs text-muted-foreground line-clamp-2">{t.descripcion}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{new Date(t.created_at).toLocaleString("es")}</p>
              </Link>
            ))}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
