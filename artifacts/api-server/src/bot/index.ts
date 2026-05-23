import { createRequire } from "module";
import { DATA_DIR, ensureDataDir } from "./dataDir.js";
import { createLogger } from "./logStore.js";
import { isAdmin } from "./adminSystem.js";
import { loadCookies, watchCookie, validateCookies, saveCookies } from "./cookieStore.js";
import { loadCommands, getCommands } from "./commandLoader.js";
import { incrementMessages, incrementCommands, incrementErrors } from "./statsTracker.js";
import type { FcaApi, FcaEvent, BotStatus, CommandContext, CookieEntry } from "./types.js";

const require = createRequire(import.meta.url);
const log = createLogger("BOT");

const PREFIX = process.env["BOT_PREFIX"] ?? "/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface BotState {
  status: BotStatus;
  uid: string | null;
  botName: string | null;
  startTime: Date | null;
  connectionType: string | null;
  errorMessage: string | null;
  api: FcaApi | null;
}

const state: BotState = {
  status: "offline",
  uid: null,
  botName: null,
  startTime: null,
  connectionType: null,
  errorMessage: null,
  api: null,
};

let _loginLock = false;
let _stopListener: (() => void) | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;

function stopListening(): void {
  if (_stopListener) {
    try { _stopListener(); } catch {}
    _stopListener = null;
  }
}

function buildCommandContext(): CommandContext {
  return {
    isAdmin,
    addAdmin: (uid, name) => {
      const { addAdmin } = require("./adminSystem.js") as typeof import("./adminSystem.js");
      addAdmin(uid, name);
    },
    removeAdmin: (uid) => {
      const { removeAdmin } = require("./adminSystem.js") as typeof import("./adminSystem.js");
      removeAdmin(uid);
    },
    getAdmins: () => {
      const { getAdmins } = require("./adminSystem.js") as typeof import("./adminSystem.js");
      return getAdmins();
    },
    prefix: PREFIX,
    startTime: state.startTime ?? new Date(),
  };
}

function handleEvent(api: FcaApi, event: FcaEvent): void {
  if (!event || event.type !== "message") return;
  if (!event.body || !event.senderID) return;

  incrementMessages();

  const body = event.body.trim();
  if (!body.startsWith(PREFIX)) return;

  const senderID = event.senderID;
  if (!isAdmin(senderID)) return;

  const parts = body.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  const commands = getCommands();
  const cmd = commands.get(commandName);
  if (!cmd) return;

  incrementCommands();
  const ctx = buildCommandContext();
  Promise.resolve()
    .then(() => cmd.execute(api, event, args, ctx))
    .catch((err: any) => {
      incrementErrors();
      log.error(`Command ${cmd.name} error: ${err?.message ?? err}`);
      api.sendMessage(`Command error: ${err?.message ?? "unknown error"}`, event.threadID!);
    });
}

// ── Messenger Session Bootstrap ────────────────────────────────────────────
// Fetches facebook.com/messages/ before fca login to:
//  1. Establish a Messenger session → sets m_sess cookie in response headers
//  2. Extract irisSeqID / sync_sequence_id from the HTML
// Both are needed for getSeqID() in fca-unofficial to succeed.
async function bootstrapMessengerSession(cookies: CookieEntry[]): Promise<{
  enrichedCookies: CookieEntry[];
  irisSeqID: string | null;
  fb_dtsg: string | null;
}> {
  const cookieHeader = cookies.map(c => `${c.key}=${c.value}`).join("; ");

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20000);

    const res = await fetch("https://www.facebook.com/messages/t/", {
      headers: {
        Cookie: cookieHeader,
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.facebook.com/",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(tid);

    const html = await res.text();

    // Try multiple patterns for the sequence ID
    let irisSeqID: string | null = null;
    const seqPatterns = [
      /irisSeqID:"(\d+)"/,
      /"iris_seq_id":"(\d+)"/,
      /"sync_sequence_id":"(\d+)"/,
      /initial_titan_sequence_id":"(\d+)"/,
      /"initialTitanSequenceID":"(\d+)"/,
    ];
    for (const p of seqPatterns) {
      const m = html.match(p);
      if (m?.[1]) { irisSeqID = m[1]; break; }
    }

    // Extract new cookies from Set-Cookie response headers
    const enrichedCookies = [...cookies];
    type GetSetCookies = () => string[];
    const setCookieHeaders: string[] =
      (res.headers as unknown as { getSetCookie?: GetSetCookies }).getSetCookie?.() ?? [];

    let newCookieCount = 0;
    for (const header of setCookieHeaders) {
      const parts = header.split(";");
      const eqIdx = (parts[0] ?? "").indexOf("=");
      if (eqIdx < 0) continue;
      const k = parts[0]!.slice(0, eqIdx).trim();
      const v = parts[0]!.slice(eqIdx + 1).trim();
      if (!k) continue;

      const idx = enrichedCookies.findIndex(c => c.key === k);
      const entry: CookieEntry = { key: k, value: v, domain: ".facebook.com", path: "/" };
      if (idx >= 0) {
        enrichedCookies[idx] = { ...enrichedCookies[idx], ...entry };
      } else {
        enrichedCookies.push(entry);
        newCookieCount++;
      }
    }

    // Also try to extract fb_dtsg token from the HTML (fca-unofficial needs this for GraphQL POSTs)
    let fb_dtsg: string | null = null;
    const dtsgPatterns = [
      /\["DTSGInitData",\[\],\{"token":"([^"]+)"/,
      /"dtsg":\{"token":"([^"]+)"/,
      /name="fb_dtsg" value="([^"]+)"/,
      /"token":"(AQ[A-Za-z0-9_\-]{10,})"/,
    ];
    for (const p of dtsgPatterns) {
      const m = html.match(p);
      if (m?.[1]) { fb_dtsg = m[1]; break; }
    }

    if (fb_dtsg) log.ok(`Got fb_dtsg from messages page: ${fb_dtsg.slice(0, 12)}...`);
    if (irisSeqID) log.ok(`Got irisSeqID from messages page: ${irisSeqID}`);
    if (newCookieCount > 0) log.ok(`Got ${newCookieCount} new cookies from Messenger (incl. m_sess)`);
    if (!fb_dtsg && !irisSeqID && newCookieCount === 0) {
      log.warn("Bootstrap: no new cookies, seqID, or fb_dtsg — session may have expired or needs refresh");
    }

    return { enrichedCookies, irisSeqID, fb_dtsg };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      log.warn("Messenger bootstrap timed out");
    } else {
      log.warn(`Messenger bootstrap failed: ${err?.message}`);
    }
    return { enrichedCookies: cookies, irisSeqID: null };
  }
}

// ── MQTT listener ──────────────────────────────────────────────────────────
function scheduleRetry(delayMs = 120000): void {
  if (_retryTimer) return;
  log.warn(`Listener failed — retrying in ${Math.round(delayMs / 1000)}s...`);
  state.status = "error";
  state.errorMessage =
    "Messenger API rejected session (error 1357001). " +
    "Update cookies from an active Messenger browser session, or wait for auto-retry.";
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    log.info("Auto-retry triggered...");
    startBot().catch(() => {});
  }, delayMs);
}

function startMqtt(api: FcaApi, attempt = 1): void {
  const MAX = 5;
  log.info(`MQTT connecting (attempt ${attempt}/${MAX})...`);
  let connected = false;

  // api.listen === api.listenMqtt in fca-unofficial v1.3.x
  const listenFn: ((cb: (err: any, ev: FcaEvent) => void) => any) =
    (api as any).listenMqtt ?? (api as any).listen;

  if (!listenFn) {
    log.error("fca-unofficial has no listen function — cannot start");
    scheduleRetry();
    return;
  }

  const emitter = listenFn.call(api, (err: any, event: FcaEvent) => {
    if (err) {
      const msg = String(err?.error ?? err?.message ?? err?.type ?? JSON.stringify(err));
      log.warn(`MQTT error: ${msg} (${attempt}/${MAX})`);

      if (attempt < MAX) {
        const delay = Math.min(attempt * 10000, 60000);
        setTimeout(() => startMqtt(api, attempt + 1), delay);
      } else {
        scheduleRetry(120000);
      }
      return;
    }

    if (!connected) {
      connected = true;
      state.connectionType = "mqtt";
      state.status = "online";
      state.errorMessage = null;
      log.ok(`MQTT connected — UID: ${api.getCurrentUserID()}`);
    }

    handleEvent(api, event);
  });

  // Store stop function — listenMqtt returns a MessageEmitter with stopListening()
  if (emitter && typeof emitter.stopListening === "function") {
    _stopListener = () => emitter.stopListening(() => {});
  }
}

// ── Main login + start ─────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  if (_loginLock) {
    log.warn("Login already in progress — ignoring");
    return;
  }
  _loginLock = true;
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }

  stopListening();
  state.api = null;
  state.uid = null;
  state.botName = null;
  state.status = "connecting";
  state.errorMessage = null;
  state.connectionType = null;

  loadCommands();

  const rawCookies = loadCookies();
  if (!rawCookies) {
    log.error("No cookies found — upload them via the panel");
    state.status = "offline";
    state.errorMessage = "No cookies — upload via Cookie Management";
    _loginLock = false;
    return;
  }

  if (!validateCookies(rawCookies)) {
    log.error("Invalid cookies — missing c_user or xs");
    state.status = "error";
    state.errorMessage = "Invalid cookies (missing c_user or xs)";
    _loginLock = false;
    return;
  }

  // Normalize: URL-decode values, ensure domain has leading dot
  const normalized: CookieEntry[] = rawCookies.map(c => ({
    ...c,
    value: (() => { try { return decodeURIComponent(c.value); } catch { return c.value; } })(),
    domain: c.domain?.startsWith(".") ? c.domain : `.${c.domain}`,
  }));

  // ── STEP 1: Bootstrap Messenger session ──────────────────────────────────
  log.info("Bootstrapping Messenger session...");
  const { enrichedCookies } = await bootstrapMessengerSession(normalized);

  // Save enriched cookies (with m_sess) so the watchdog doesn't re-trigger
  try { saveCookies(enrichedCookies, true); } catch {}

  // ── STEP 2: fca-unofficial login ──────────────────────────────────────────
  let fcaLogin: (creds: any, opts: any, cb: (err: any, api: FcaApi) => void) => void;
  try {
    fcaLogin = require("fca-unofficial") as typeof fcaLogin;
  } catch (err: any) {
    log.error(`Failed to load fca-unofficial: ${err?.message}`);
    state.status = "error";
    state.errorMessage = `Library load error: ${err?.message}`;
    _loginLock = false;
    return;
  }

  log.info("Logging in with cookies...");

  let attempt = 0;
  const MAX_ATTEMPTS = 3;

  function tryLogin(): void {
    attempt++;
    log.info(`Login attempt ${attempt}/${MAX_ATTEMPTS}...`);

    fcaLogin(
      { appState: enrichedCookies },
      {
        logLevel: "silent",
        selfListen: false,
        listenEvents: true,
        forceLogin: true,
        userAgent: UA,
        autoMarkDelivery: false,
        autoMarkRead: false,
      },
      async (err, api) => {
        if (err) {
          const msg = String(err?.message ?? err?.error ?? err);
          log.error(`Login failed (${attempt}/${MAX_ATTEMPTS}): ${msg}`);
          if (attempt < MAX_ATTEMPTS) {
            setTimeout(tryLogin, attempt * 5000);
            return;
          }
          state.status = "error";
          state.errorMessage = `Login failed: ${msg}`;
          _loginLock = false;
          return;
        }

        const uid = api.getCurrentUserID();

        // Persist updated appState (fca may have refreshed tokens)
        try {
          const appState = (api as any).getAppState?.() as CookieEntry[] | undefined;
          if (appState?.length) saveCookies(appState, true);
        } catch {}

        // Resolve display name
        let botName = "ALPHA Bot";
        try {
          const info = await new Promise<Record<string, any>>((res, rej) =>
            api.getUserInfo(uid, (e, d) => (e ? rej(e) : res(d)))
          );
          botName = info[uid]?.name ?? botName;
        } catch {}

        state.api = api;
        state.uid = uid;
        state.botName = botName;
        state.status = "online";
        state.startTime = new Date();
        state.errorMessage = null;

        log.ok(`Logged in as ${botName} (UID: ${uid})`);
        _loginLock = false;

        // ── STEP 3: Start MQTT listener ───────────────────────────────────
        startMqtt(api);
      }
    );
  }

  tryLogin();
}

export function stopBot(): void {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  stopListening();
  state.api = null;
  state.status = "offline";
  state.uid = null;
  state.botName = null;
  state.startTime = null;
  state.connectionType = null;
  state.errorMessage = null;
  log.info("Bot stopped");
}

export function restartBot(): void {
  log.info("Restarting bot...");
  stopBot();
  _reconnectTimer = setTimeout(() => startBot(), 2000);
}

export function getBotState(): BotState {
  return { ...state };
}

export function getUptimeSeconds(): number {
  if (!state.startTime) return 0;
  return Math.floor((Date.now() - state.startTime.getTime()) / 1000);
}

export function initBot(): void {
  ensureDataDir();
  log.info("ALPHA Bot initializing...");

  watchCookie(() => {
    log.info("Cookie changed — reconnecting...");
    restartBot();
  });

  const cookies = loadCookies();
  if (cookies && validateCookies(cookies)) {
    startBot().catch((err: any) => log.error(`Startup error: ${err?.message}`));
  } else {
    log.warn("No valid cookies — waiting for cookie upload via panel");
    state.status = "offline";
    state.errorMessage = "No cookies configured";
  }
}
