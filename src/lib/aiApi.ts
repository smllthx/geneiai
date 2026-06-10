import { supabase } from "@/integrations/supabase/client";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión no encontrada");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function post<T>(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "La IA no pudo procesar la solicitud");
  return json as T;
}

export function extractDocumentAI(body: { document_id?: string; text?: string }) {
  return post<{ ok: boolean; data: any }>("/api/ai/extract", body);
}

export function suggestRelationsAI(personId: string) {
  return post<{ ok: boolean; created: number; suggestions: any[] }>("/api/ai/suggest-relations", { person_id: personId });
}

export function generateBiographyAI(personId: string) {
  return post<{ ok: boolean; biography: any }>("/api/ai/biography", { person_id: personId });
}
