// CRUD de credenciales externas con cifrado AES-GCM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getKey() {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "fallback-key-change-me";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("creds-v1:" + secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

async function decrypt(b64: string): Promise<string> {
  const key = await getKey();
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12); const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const body = await req.json();
    const { action, proveedor, username, password } = body;

    if (action === "list") {
      const { data, error } = await supabase
        .from("credenciales_externas")
        .select("id, proveedor, username, updated_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ items: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save") {
      if (!proveedor || !password) throw new Error("Faltan datos");
      const cifrado = await encrypt(password);
      const { error } = await supabase.from("credenciales_externas").upsert({
        user_id: user.id, proveedor, username: username ?? null, password_cifrado: cifrado,
      }, { onConflict: "user_id,proveedor" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get") {
      const { data, error } = await supabase
        .from("credenciales_externas").select("*")
        .eq("user_id", user.id).eq("proveedor", proveedor).maybeSingle();
      if (error) throw error;
      if (!data) return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const plain = await decrypt(data.password_cifrado);
      return new Response(JSON.stringify({ found: true, username: data.username, password: plain }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await supabase.from("credenciales_externas").delete()
        .eq("user_id", user.id).eq("proveedor", proveedor);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Acción desconocida");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
