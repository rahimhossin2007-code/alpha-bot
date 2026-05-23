import path from "path";
import fs from "fs";
import { DATA_DIR, readJson, writeJson } from "./dataDir.js";
import type { CookieEntry } from "./types.js";
import { createLogger } from "./logStore.js";

const log = createLogger("COOKIE");
const COOKIE_FILE = path.join(DATA_DIR, "cookie.json");

let _selfWriting = false;
let _selfWriteTimer: ReturnType<typeof setTimeout> | null = null;

export interface CookieInfo {
  hasCookie: boolean;
  format: string;
  uid: string | null;
  lastUpdated: string | null;
}

export function getCookieInfo(): CookieInfo {
  const cookies = readJson<CookieEntry[] | null>(COOKIE_FILE, null);
  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
    return { hasCookie: false, format: "none", uid: null, lastUpdated: null };
  }
  const cUser = cookies.find((c) => c.key === "c_user");
  const lastUpdated = (() => {
    try {
      const stat = fs.statSync(COOKIE_FILE);
      return stat.mtime.toISOString();
    } catch {
      return null;
    }
  })();
  return {
    hasCookie: true,
    format: "c3c-json",
    uid: cUser?.value ?? null,
    lastUpdated,
  };
}

export function loadCookies(): CookieEntry[] | null {
  const cookies = readJson<CookieEntry[] | null>(COOKIE_FILE, null);
  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) return null;
  return cookies;
}

export function saveCookies(cookies: CookieEntry[], silent = false): void {
  _selfWriting = true;
  if (_selfWriteTimer) clearTimeout(_selfWriteTimer);
  _selfWriteTimer = setTimeout(() => { _selfWriting = false; }, 6000);

  writeJson(COOKIE_FILE, cookies);
  if (!silent) log.ok("Cookie saved to disk");
}

export function parseCookieInput(input: string): CookieEntry[] | null {
  const trimmed = input.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].key) {
      return parsed as CookieEntry[];
    }
    return null;
  } catch {
    return null;
  }
}

export function validateCookies(cookies: CookieEntry[]): boolean {
  const hasUser = cookies.some((c) => c.key === "c_user");
  const hasXS = cookies.some((c) => c.key === "xs");
  return hasUser && hasXS;
}

let _cookieWatcher: ReturnType<typeof fs.watch> | null = null;

export function watchCookie(onChange: () => void): void {
  if (_cookieWatcher) {
    try { _cookieWatcher.close(); } catch {}
    _cookieWatcher = null;
  }

  if (!fs.existsSync(COOKIE_FILE)) {
    fs.writeFileSync(COOKIE_FILE, "null", "utf8");
  }

  let debounce: ReturnType<typeof setTimeout> | null = null;

  _cookieWatcher = fs.watch(COOKIE_FILE, () => {
    if (_selfWriting) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      log.info("Cookie file changed externally — triggering reconnect");
      onChange();
    }, 2500);
  });

  _cookieWatcher.on("error", (err) => {
    log.warn(`Cookie watcher error: ${err.message}`);
  });
}
