import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requestNotificationPermission, notificationPermission, subscribeToPush } from "@/lib/notifications";
import { toast } from "sonner";

export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const [perm, setPerm] = useState<NotificationPermission>("default");

  const load = async () => {
    const { data } = await supabase.from("notificaciones")
      .select("*").order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  };

  useEffect(() => {
    setPerm(notificationPermission());
    load();
    const ch = supabase
      .channel("notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const noLeidas = items.filter((i) => !i.leida).length;
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
          {noLeidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{noLeidas}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
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
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin notificaciones.</p>
          ) : items.map((n) => (
            <Link key={n.id} to={n.url ?? "#"} className={`block border-b px-3 py-2 text-sm hover:bg-foreground/5 ${!n.leida ? "bg-primary/5" : ""}`}>
              <p className="font-medium">{n.titulo}</p>
              {n.mensaje && <p className="text-xs text-muted-foreground">{n.mensaje}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("es")}</p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
