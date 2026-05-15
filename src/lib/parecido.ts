// Motor de parecido y estimación genética
// Calcula score 0-100 entre dos personas según rasgos + ajusta por parentesco genealógico.

import type { Tables } from "@/integrations/supabase/types";

export type Rasgos = Record<string, string | string[] | number | undefined>;

// Pesos heredables (basados en heredabilidad estimada de rasgos visibles)
const PESOS: Record<string, number> = {
  color_ojos: 18,
  color_pelo: 12,
  forma_cara: 14,
  forma_ojos: 10,
  nariz: 12,
  boca: 6,
  menton: 8,
  frente: 6,
  cejas: 5,
  tipo_pelo: 5,
  complexion: 4,
};

export interface ParecidoResult {
  score: number; // 0-100
  rasgos_comunes: { rasgo: string; valor: string; peso: number }[];
  estimacion_genetica: number; // 0-1 fracción compartida estimada
  detalle: string;
}

export function compararRasgos(a: Rasgos, b: Rasgos): { score: number; comunes: ParecidoResult["rasgos_comunes"] } {
  let total = 0, alcanzados = 0;
  const comunes: ParecidoResult["rasgos_comunes"] = [];
  for (const [rasgo, peso] of Object.entries(PESOS)) {
    const va = a?.[rasgo]; const vb = b?.[rasgo];
    if (!va || !vb || va === "desconocido" || vb === "desconocido") continue;
    total += peso;
    if (va === vb) { alcanzados += peso; comunes.push({ rasgo, valor: String(va), peso }); }
  }
  const score = total > 0 ? Math.round((alcanzados / total) * 100) : 0;
  return { score, comunes };
}

// Estimación genética: combina parentesco genealógico esperado (si lo hay) con observación facial
export function estimacionGenetica(parentescoEsperado: number | null, scoreFacial: number): number {
  // Si tenemos parentesco genealógico, lo usamos como prior; refinamos con observación
  const obs = scoreFacial / 100; // 0..1
  if (parentescoEsperado == null) return Math.round(obs * 1000) / 1000;
  // Weighted: 70% prior genealógico, 30% observación
  return Math.round((parentescoEsperado * 0.7 + obs * 0.3) * 1000) / 1000;
}

// Fracción esperada de ADN compartido según grado de parentesco (consanguíneos)
export const PARENTESCO_ADN: Record<string, number> = {
  identico: 1,
  padre: 0.5, madre: 0.5, hijo: 0.5, hija: 0.5,
  hermano: 0.5, hermana: 0.5,
  abuelo: 0.25, abuela: 0.25, nieto: 0.25, nieta: 0.25,
  tio: 0.25, tia: 0.25, sobrino: 0.25, sobrina: 0.25,
  primo: 0.125, prima: 0.125,
  bisabuelo: 0.125, bisabuela: 0.125,
  tatarabuelo: 0.0625, tatarabuela: 0.0625,
};

export function parentescoFraccion(tipo: string | null | undefined): number | null {
  if (!tipo) return null;
  const k = tipo.toLowerCase();
  return PARENTESCO_ADN[k] ?? null;
}
