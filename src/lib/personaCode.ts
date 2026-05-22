// Genera un código corto, estable y legible para una persona (estilo FamilySearch: GDVB-TS5).
// Determinístico a partir del UUID: misma persona → mismo código siempre.
// 4 chars + "-" + 3 chars, alfabeto sin caracteres ambiguos.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión

function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function personaCode(uuid?: string | null): string {
  if (!uuid) return "----";
  // dos hashes con sales distintas para 7 chars totales
  const a = hash32("a:" + uuid);
  const b = hash32("b:" + uuid);
  const out: string[] = [];
  let x = a;
  for (let i = 0; i < 4; i++) { out.push(ALPHABET[x % ALPHABET.length]); x = Math.floor(x / ALPHABET.length) || hash32(uuid + i); }
  out.push("-");
  let y = b;
  for (let i = 0; i < 3; i++) { out.push(ALPHABET[y % ALPHABET.length]); y = Math.floor(y / ALPHABET.length) || hash32(uuid + "y" + i); }
  return out.join("");
}

/** Permite búsqueda por código: normaliza input del usuario. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

/** Compara código contra una persona. */
export function matchesCode(input: string, uuid: string): boolean {
  const a = normalizeCode(input);
  const b = personaCode(uuid).replace("-", "");
  return a.length >= 4 && b.startsWith(a);
}
