import { supabase } from "@/integrations/supabase/client";

export async function requestBiographyProposal(personId: string) {
  const { data, error } = await supabase.functions.invoke("biografia-auto", { body: { person_id: personId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (data?.review_required !== true || data.applied !== false || !data.sugerencia_id) {
    throw new Error("No se recibió una propuesta de biografía para revisar.");
  }
  return String(data.sugerencia_id);
}
