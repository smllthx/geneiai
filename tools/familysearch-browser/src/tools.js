import { existsSync } from "node:fs";
import { COOKIES_FILE, FS_BASE, FS_SEARCH_URL } from "./config.js";
import * as browser from "./browser.js";
import {
  DomChangedError,
  LoginRequiredError,
  parsePersonFacts,
  parseRelatives,
  parseSearchRows,
  parseSources,
  personUrl,
  sourcesUrl,
  extractPid,
} from "./parse.js";

const LOGIN_REQUIRED = { ok: false, status: "login_required" };

function loginRequired(extra = {}) {
  return { ...LOGIN_REQUIRED, ...extra, message: "Inicia sesión manualmente en la ventana de FamilySearch y vuelve a intentarlo." };
}

/** 1. familysearch_browser_open */
export async function open() {
  await browser.goto(`${FS_BASE}/tree/find`);
  const session = await browser.currentSession();
  return {
    ok: true,
    opened: true,
    browser: browser.browserState(),
    logged_in: session.logged_in,
    status: session.logged_in ? "ready" : "login_required",
    message: session.logged_in
      ? "Navegador abierto con sesión activa."
      : "Navegador abierto. Inicia sesión manualmente en la ventana (GENAIA no lee ni guarda tu contraseña).",
  };
}

/** 2. familysearch_browser_status */
export async function status() {
  const state = browser.browserState();
  if (!state.running) {
    return {
      ok: true,
      browser: state,
      logged_in: false,
      status: "closed",
      cookies_stored: existsSync(COOKIES_FILE),
    };
  }
  const session = await browser.currentSession();
  return {
    ok: true,
    browser: state,
    logged_in: session.logged_in,
    status: session.logged_in ? "ready" : "login_required",
    url: session.url,
    cookies_stored: existsSync(COOKIES_FILE),
  };
}

function buildSearchUrl({ nombre, apellido, anio, lugar }) {
  const params = new URLSearchParams();
  const q = [];
  if (nombre) q.push(`q.givenName=${encodeURIComponent(nombre)}`);
  if (apellido) q.push(`q.surname=${encodeURIComponent(apellido)}`);
  if (anio) q.push(`q.birthLikeDate.from=${anio - 2}&q.birthLikeDate.to=${anio + 2}`);
  if (lugar) q.push(`q.birthLikePlace=${encodeURIComponent(lugar)}`);
  params.toString();
  return `${FS_SEARCH_URL}?${q.join("&")}`;
}

async function requireSession() {
  const session = await browser.currentSession();
  if (!session.logged_in) throw new LoginRequiredError();
  return session;
}

/** 3. familysearch_browser_search_people */
export async function searchPeople({ nombre, apellido, anio, lugar, limit = 20 } = {}) {
  if (!nombre && !apellido) {
    return { ok: false, status: "invalid_input", message: "Indica al menos nombre o apellido." };
  }
  try {
    await requireSession();
  } catch (err) {
    if (err instanceof LoginRequiredError) return loginRequired();
    throw err;
  }
  const url = buildSearchUrl({ nombre, apellido, anio: anio ? Number(anio) : null, lugar });
  const page = await browser.goto(url);
  await page.waitForTimeout(2000);
  const rows = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/tree/person/"], a[href*="/ark:/"]'));
    const seen = new Set();
    const out = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") ?? "";
      const name = (a.textContent ?? "").trim();
      if (!name || name.length > 120) continue;
      const row = a.closest("tr, li, article, [role='row']");
      const details = row ? (row.innerText ?? "") : "";
      const key = href + "|" + name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, url: new URL(href, location.origin).toString(), details });
    }
    return out;
  });
  const results = parseSearchRows(rows).slice(0, Math.max(1, Math.min(50, Number(limit) || 20)));
  if (!results.length) {
    return { ok: true, results: [], searched_url: url, message: "Sin resultados visibles para esos criterios." };
  }
  return { ok: true, results, searched_url: url };
}

/** 4. familysearch_browser_get_person */
export async function getPerson({ pid } = {}) {
  const clean = extractPid(pid ?? "");
  if (!clean) return { ok: false, status: "invalid_input", message: "PID inválido (formato ABCD-123)." };
  try {
    await requireSession();
  } catch (err) {
    if (err instanceof LoginRequiredError) return loginRequired({ pid: clean });
    throw err;
  }
  const url = personUrl(clean);
  const page = await browser.goto(url);
  await page.waitForTimeout(2000);
  const raw = await page.evaluate(() => {
    const heading = document.querySelector("h1, [data-testid='person-name']");
    const pairs = Array.from(document.querySelectorAll("tr, li, [role='row']"))
      .map((el) => {
        const text = (el.innerText ?? "").trim();
        if (!text || text.length > 400) return null;
        const [label, ...rest] = text.split("\n");
        return rest.length ? { label, value: rest.join(" ") } : null;
      })
      .filter(Boolean)
      .slice(0, 120);
    const groups = Array.from(document.querySelectorAll("section, [data-testid]")).map((section) => {
      const relation = (section.querySelector("h2, h3, header")?.textContent ?? "").trim();
      const people = Array.from(section.querySelectorAll('a[href*="/tree/person/"]')).map((a) => ({
        name: (a.textContent ?? "").trim(),
        url: new URL(a.getAttribute("href") ?? "", location.origin).toString(),
        detail: (a.closest("li, tr, div")?.innerText ?? "").trim().split("\n")[1] ?? null,
      }));
      return people.length ? { relation, people } : null;
    }).filter(Boolean);
    return { name: (heading?.textContent ?? "").trim(), pairs, groups, bodyLen: document.body?.innerText?.length ?? 0 };
  });
  if (!raw.name && raw.bodyLen < 200) {
    throw new DomChangedError("No se pudo leer la ficha visible de la persona en FamilySearch (posible cambio de DOM).", { pid: clean, url });
  }
  return {
    ok: true,
    pid: clean,
    url,
    name: raw.name || null,
    facts: parsePersonFacts(raw.pairs),
    relatives: parseRelatives(raw.groups),
  };
}

/** 5. familysearch_browser_get_sources */
export async function getSources({ pid } = {}) {
  const clean = extractPid(pid ?? "");
  if (!clean) return { ok: false, status: "invalid_input", message: "PID inválido (formato ABCD-123)." };
  try {
    await requireSession();
  } catch (err) {
    if (err instanceof LoginRequiredError) return loginRequired({ pid: clean });
    throw err;
  }
  const url = sourcesUrl(clean);
  const page = await browser.goto(url);
  await page.waitForTimeout(2000);
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("li, tr, article"))
      .map((el) => {
        const link = el.querySelector("a[href]");
        const title = (link?.textContent ?? "").trim();
        if (!title || title.length > 200) return null;
        const lines = (el.innerText ?? "").trim().split("\n").map((s) => s.trim()).filter(Boolean);
        return {
          title,
          url: link ? new URL(link.getAttribute("href") ?? "", location.origin).toString() : null,
          detail: lines.slice(1).join(" · ") || null,
        };
      })
      .filter(Boolean)
      .slice(0, 100);
  });
  return { ok: true, pid: clean, url, sources: parseSources(rows) };
}

/** 6. familysearch_browser_logout */
export async function logoutTool() {
  const removed = await browser.logout();
  return { ok: true, logged_out: true, cookies_removed: removed, message: "Navegador cerrado y cookies locales eliminadas." };
}

export const TOOLS = {
  familysearch_browser_open: open,
  familysearch_browser_status: status,
  familysearch_browser_search_people: searchPeople,
  familysearch_browser_get_person: getPerson,
  familysearch_browser_get_sources: getSources,
  familysearch_browser_logout: logoutTool,
};

export const TOOL_NAMES = Object.keys(TOOLS);
