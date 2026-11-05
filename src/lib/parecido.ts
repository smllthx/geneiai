export type Rasgos = Record<string, string | string[] | number | undefined>;

// Peso relativo de cada descriptor en la comparación visual.
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
