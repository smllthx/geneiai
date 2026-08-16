import os from "node:os";
import path from "node:path";

export const HOST = "127.0.0.1";
export const PORT = Number(process.env.GENAIA_FS_BROWSER_PORT ?? 8787);

export const STATE_DIR = process.env.GENAIA_FS_STATE_DIR
  ? path.resolve(process.env.GENAIA_FS_STATE_DIR)
  : path.join(os.homedir(), ".genaia", "familysearch");

export const COOKIES_FILE = path.join(STATE_DIR, "cookies.json");

export const FS_BASE = "https://www.familysearch.org";
export const FS_TREE_BASE = `${FS_BASE}/tree/find`;
export const FS_SEARCH_URL = `${FS_BASE}/search/tree/results`;

/** Orden de canales de navegador visible: Chrome real primero, Chromium como fallback. */
export const BROWSER_CHANNELS = ["chrome", "chromium"];

export const NAV_TIMEOUT = Number(process.env.GENAIA_FS_TIMEOUT ?? 45000);
