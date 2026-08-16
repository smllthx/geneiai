import fs from "node:fs/promises";
import { COOKIES_FILE, STATE_DIR } from "./config.js";

/**
 * Persistencia de SOLO cookies. Nunca se guardan contraseñas, tokens escritos por
 * el usuario, ni localStorage. Permisos restrictivos (0700 dir / 0600 archivo).
 */
export async function ensureStateDir() {
  await fs.mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
  try {
    await fs.chmod(STATE_DIR, 0o700);
  } catch {
    /* sistemas sin chmod */
  }
}

export async function loadCookies() {
  try {
    const raw = await fs.readFile(COOKIES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.cookies) ? parsed.cookies : [];
  } catch {
    return [];
  }
}

export async function saveCookies(cookies) {
  await ensureStateDir();
  const safe = (cookies ?? []).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));
  await fs.writeFile(COOKIES_FILE, JSON.stringify({ saved_at: new Date().toISOString(), cookies: safe }, null, 2), {
    mode: 0o600,
  });
  try {
    await fs.chmod(COOKIES_FILE, 0o600);
  } catch {
    /* noop */
  }
  return safe.length;
}

export async function clearCookies() {
  try {
    await fs.rm(COOKIES_FILE, { force: true });
    return true;
  } catch {
    return false;
  }
}
