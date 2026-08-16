import { BROWSER_CHANNELS, FS_BASE, NAV_TIMEOUT } from "./config.js";
import { clearCookies, loadCookies, saveCookies } from "./cookies.js";
import { looksLoggedOut } from "./parse.js";

let browser = null;
let context = null;
let page = null;
let launchedChannel = null;

async function launch() {
  // Especificador en variable + @vite-ignore: Playwright es dependencia SOLO de la
  // herramienta local, nunca del bundle de la app.
  const spec = "playwright";
  const { chromium } = await import(/* @vite-ignore */ spec);
  let lastError = null;
  for (const channel of BROWSER_CHANNELS) {
    try {
      const opts = { headless: false, args: ["--start-maximized"] };
      if (channel !== "chromium") opts.channel = channel;
      const b = await chromium.launch(opts);
      launchedChannel = channel;
      return b;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `No se pudo abrir un navegador visible (Chrome ni Chromium). Ejecuta "npm run familysearch:browser:install". Detalle: ${lastError?.message ?? "desconocido"}`,
  );
}

export async function getPage() {
  if (page && !page.isClosed()) return page;
  if (!browser || !browser.isConnected()) {
    browser = await launch();
    context = null;
  }
  if (!context) {
    context = await browser.newContext({ viewport: null });
    // Nunca se graban trazas, vídeos, HAR ni capturas: el login es privado.
    const cookies = await loadCookies();
    if (cookies.length) {
      try {
        await context.addCookies(cookies);
      } catch {
        /* cookies caducadas o inválidas: se ignoran */
      }
    }
    context.on("close", () => {
      context = null;
      page = null;
    });
  }
  page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  return page;
}

export function browserState() {
  return {
    running: Boolean(browser && browser.isConnected()),
    channel: launchedChannel,
  };
}

export async function persistSession() {
  if (!context) return 0;
  const cookies = await context.cookies();
  return saveCookies(cookies);
}

export async function goto(url) {
  const p = await getPage();
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  return p;
}

export async function currentSession() {
  const p = await getPage();
  if (!p.url().includes("familysearch.org")) {
    await p.goto(`${FS_BASE}/tree/find`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
  }
  const url = p.url();
  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "");
  const loggedOut = looksLoggedOut({ url, bodyText });
  if (!loggedOut) await persistSession();
  return { url, logged_in: !loggedOut };
}

export async function shutdown() {
  try {
    if (context) await context.close();
  } catch {
    /* noop */
  }
  try {
    if (browser) await browser.close();
  } catch {
    /* noop */
  }
  context = null;
  page = null;
  browser = null;
  launchedChannel = null;
}

export async function logout() {
  await shutdown();
  const removed = await clearCookies();
  return removed;
}
