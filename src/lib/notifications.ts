// Notificaciones locales del navegador + helpers de permiso.
// Para push real en segundo plano hace falta VAPID + service worker registrado.

import { supabase } from "@/integrations/supabase/client";

export const supportsNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

export const notificationPermission = (): NotificationPermission =>
  supportsNotifications() ? Notification.permission : "denied";

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsNotifications()) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export async function notify(titulo: string, opts: { body?: string; url?: string; tag?: string } = {}) {
  // Guarda en la BD para el centro de notificaciones
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notificaciones").insert({
        user_id: user.id,
        titulo,
        mensaje: opts.body ?? null,
        url: opts.url ?? null,
        tipo: "info",
      });
    }
  } catch {}
  // Notificación nativa si hay permiso
  if (supportsNotifications() && Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(titulo, {
            body: opts.body,
            icon: "/app-icon-512.png",
            badge: "/app-icon-512.png",
            tag: opts.tag,
            data: { url: opts.url ?? "/" },
          });
          return;
        }
      }
      new Notification(titulo, { body: opts.body, icon: "/app-icon-512.png", tag: opts.tag });
    } catch {}
  }
}

// Suscripción push (requiere VAPID public key configurada como secret VAPID_PUBLIC_KEY)
export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const json = sub.toJSON() as any;
  await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    keys: json.keys ?? {},
    user_agent: navigator.userAgent,
  }, { onConflict: "endpoint" });
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
