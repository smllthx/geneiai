import { supabase } from "@/integrations/supabase/client";
import { checkCoherence } from "@/lib/coherence";

const y = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const isCreditOrAiError = (e: any) => {
  const msg = norm(`${e?.message ?? e?.error?.message ?? e?.details ?? e ?? ""}`);
  return msg.includes("openai no configurado") || msg.includes("api key") || msg.includes("402") || msg.includes("429") || msg.includes("non-2xx");
};

export function localPersonaInsight(persona: any) {
  const born = y(persona?.nac_fecha) ?? persona?.nac_rango_ini;
  const died = y(persona?.defuncion_fecha);
  if (born && died) return `Vivió aproximadamente ${died - born} años; revisá si existen fotos, fuentes o eventos que completen esa etapa.`;
  if (born) return `Pertenece a la generación nacida alrededor de ${born}; conviene buscar censos, bautismos y registros civiles de esa década.`;
  if (persona?.ocupacion) return `Su oficio registrado (${persona.ocupacion}) puede orientar búsquedas en padrones, gremios o prensa local.`;
  return "Faltan fechas o lugares clave: nacimiento, matrimonio, defunción y fuentes ayudan a completar el perfil.";
}

export function localPhotoAnalysis({ titulo, descripcion, fechaAprox }: { titulo?: string; descripcion?: string; fechaAprox?: string }) {
  const text = [titulo, descripcion, fechaAprox].filter(Boolean).join(" ");
  const year = text.match(/(17|18|19|20)\d{2}/)?.[0];
  const decade = year ? `${year.slice(0, 3)}0s` : fechaAprox?.match(/\d{3}0s/i)?.[0];
  return {
    descripcion: [
      descripcion || "Foto familiar pendiente de revisión visual detallada.",
      "— Análisis local: etiquetá personas, agregá lugar y confirma fecha aproximada para mejorar álbumes, memorias y coincidencias.",
    ].join("\n"),
    ano_estimado: year ? Number(year) : undefined,
    decada_estimada: decade,
    lugar_estimado: undefined,
    clase_social: "desconocida",
    tipo_foto: "retrato",
    etiquetas: ["análisis local", "revisar", "genealogía"],
  };
}

export async function localAssistantReply(text: string) {
  const q = norm(text);
  const tool_events: any[] = [];
  if (q.includes("arbol")) {
    tool_events.push({ name: "navigate_to", result: { ok: true, navigate_to: "/arbol" } });
    return { content: "Abro el árbol familiar. Esta acción se resolvió localmente.", tool_events };
  }
  if (q.includes("persona")) {
    tool_events.push({ name: "navigate_to", result: { ok: true, navigate_to: "/personas" } });
    return { content: "Te llevo a Personas para revisar o editar fichas.", tool_events };
  }
  if (q.includes("coherencia") || q.includes("verifica")) {
    const [{ data: personas }, { data: rels }] = await Promise.all([
      supabase.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha"),
      supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
    ]);
    const issues = checkCoherence((personas ?? []) as any, (rels ?? []) as any);
    return { content: `Revisión local terminada: ${issues.length} aviso(s) encontrados. ${issues.length ? "Abrí Insights o el árbol para revisarlos." : "El árbol se ve coherente."}`, tool_events };
  }
  if (q.includes("buscar") || q.includes("investigar")) {
    return { content: "Puedo preparar búsquedas locales con nombres, fechas, lugares, FamilySearch, cementerios y prensa local. Para análisis generativo con ChatGPT, configura tu API key de OpenAI en Configuración → IA.", tool_events };
  }
  return { content: "Puedo navegar, revisar coherencia, ordenar datos y sugerir próximos pasos localmente. Para respuestas generativas con ChatGPT, configura tu API key de OpenAI en Configuración → IA.", tool_events };
}
