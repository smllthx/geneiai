import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user_id, titulo, mensaje, url, notificacion_id } = await req.json();
    if (!user_id || !titulo) {
      return new Response(JSON.stringify({ error: "user_id y titulo requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("user_id", user_id);
    if (error) throw error;

    const payload = JSON.stringify({ title: titulo, body: mensaje ?? "", url: url ?? "/", id: notificacion_id });
    const results = await Promise.allSettled((subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        return { id: s.id, ok: true };
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
        return { id: s.id, ok: false, error: String(e?.message ?? e) };
      }
    }));
    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
