/**
 * Funciones puras de parsing. No tocan el navegador ni la red, por eso son
 * testeables sin credenciales. Si el DOM de FamilySearch cambia y no se puede
 * extraer lo esperado, se lanza DomChangedError (error explícito, nunca datos
 * inventados).
 */

export class DomChangedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "DomChangedError";
    this.code = "FS_DOM_CHANGED";
    this.details = details ?? null;
  }
}

export class LoginRequiredError extends Error {
  constructor(message = "Necesitas iniciar sesión en FamilySearch en la ventana del navegador.") {
    super(message);
    this.name = "LoginRequiredError";
    this.code = "login_required";
  }
}

const PID_RE = /\b([A-Z0-9]{4}-[A-Z0-9]{3,4})\b/;

/** Extrae un PID de FamilySearch (formato ABCD-123 / ABCD-1234) de una URL o texto. */
export function extractPid(input) {
  if (typeof input !== "string") return null;
  const m = PID_RE.exec(input.toUpperCase());
  return m ? m[1] : null;
}

export function isValidPid(input) {
  const pid = extractPid(input ?? "");
  return Boolean(pid) && pid === String(input ?? "").trim().toUpperCase();
}

export function personUrl(pid) {
  const clean = extractPid(pid ?? "");
  if (!clean) throw new DomChangedError("PID inválido.", { pid });
  return `https://www.familysearch.org/tree/person/details/${clean}`;
}

export function sourcesUrl(pid) {
  const clean = extractPid(pid ?? "");
  if (!clean) throw new DomChangedError("PID inválido.", { pid });
  return `https://www.familysearch.org/tree/person/sources/${clean}`;
}

export function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length ? text : null;
}

/** Separa un bloque de texto visible en líneas limpias. */
export function textLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

/** Detecta fechas/años visibles tal como los muestra la UI (sin inventar formato). */
export function pickYear(value) {
  const text = String(value ?? "");
  const m = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Convierte filas crudas extraídas del DOM en resultados normalizados.
 * rows: [{ name, url, details }]
 */
export function parseSearchRows(rows) {
  if (!Array.isArray(rows)) {
    throw new DomChangedError("La lista de resultados de FamilySearch no tiene el formato esperado.");
  }
  const out = [];
  for (const row of rows) {
    const url = normalizeText(row?.url);
    const pid = extractPid(url ?? "") ?? extractPid(row?.pid ?? "");
    const name = normalizeText(row?.name);
    if (!pid || !name) continue;
    const details = textLines(row?.details);
    out.push({
      pid,
      name,
      url: url && url.startsWith("http") ? url : personUrl(pid),
      details,
      birth: details.find((d) => /naci|birth|nato|geboren/i.test(d)) ?? null,
      death: details.find((d) => /falleci|death|defun|morte|gestorben/i.test(d)) ?? null,
      year: pickYear(details.join(" ")),
    });
  }
  if (rows.length > 0 && out.length === 0) {
    throw new DomChangedError(
      "FamilySearch devolvió resultados pero no se reconoció su estructura (posible cambio de DOM). Revisa la ventana del navegador.",
      { received: rows.length },
    );
  }
  return out;
}

/** Normaliza los pares etiqueta/valor visibles de la ficha de una persona. */
export function parsePersonFacts(pairs) {
  if (!Array.isArray(pairs)) {
    throw new DomChangedError("La ficha de la persona no tiene el formato esperado.");
  }
  const facts = [];
  for (const pair of pairs) {
    const label = normalizeText(pair?.label);
    const value = normalizeText(pair?.value);
    if (!label || !value) continue;
    facts.push({ label, value, year: pickYear(value) });
  }
  return facts;
}

/** Normaliza relaciones visibles agrupadas por sección. */
export function parseRelatives(groups) {
  if (!Array.isArray(groups)) {
    throw new DomChangedError("Las relaciones visibles no tienen el formato esperado.");
  }
  const out = [];
  for (const group of groups) {
    const relation = normalizeText(group?.relation) ?? "relacionado";
    for (const person of group?.people ?? []) {
      const name = normalizeText(person?.name);
      const pid = extractPid(person?.url ?? "") ?? extractPid(person?.pid ?? "");
      if (!name) continue;
      out.push({
        relation,
        name,
        pid: pid ?? null,
        url: pid ? personUrl(pid) : null,
        detail: normalizeText(person?.detail),
      });
    }
  }
  return out;
}

/** Normaliza fuentes visibles. */
export function parseSources(rows) {
  if (!Array.isArray(rows)) {
    throw new DomChangedError("Las fuentes visibles no tienen el formato esperado.");
  }
  return rows
    .map((row) => ({
      title: normalizeText(row?.title),
      url: normalizeText(row?.url),
      detail: normalizeText(row?.detail),
    }))
    .filter((row) => row.title);
}

/** Heurística de sesión: la URL/el contenido indican pantalla de identificación. */
export function looksLoggedOut({ url, bodyText } = {}) {
  const u = String(url ?? "").toLowerCase();
  if (/ident\.familysearch\.org|\/auth\/|\/signin|\/login/.test(u)) return true;
  const text = String(bodyText ?? "").toLowerCase();
  if (!text) return false;
  return /(iniciar sesión|sign in to familysearch|crear cuenta gratis)/.test(text) && !/\/tree\/person\//.test(u);
}
