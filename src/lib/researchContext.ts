export function buildAssistantContext(personId: string, name: string) {
  const params = new URLSearchParams({ tab: 'asistente', persona: personId, prompt: `Investiga la ficha de ${name}, ID ${personId}. Revisa sus datos, relaciones y fuentes; propone hallazgos para confirmar.` });
  return `/investigacion?${params}`;
}
