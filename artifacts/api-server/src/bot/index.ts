import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { DATA_DIR, ensureDataDir } from "./dataDir.js";
import { createLogger } from "./logStore.js";
import { isAdmin } from "./adminSystem.js";
import { loadCookies, watchCookie, parseCookieInput, validateCookies, saveCookies } from "./cookieStore.js";
import { loadCommands, getCommands } from "./commandLoader.js";
import { incrementMessages, incrementCommands, incrementErrors } from "./statsTracker.js";
import type { FcaApi, FcaEvent, BotStatus, CommandContext } from "./types.js";

const require = createRequire(import.meta.url);
const log = createLogger("BOT");

const PREFIX = process.env["BOT_PREFIX"] ?? "/";

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
let _listenTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function stopListening(): void {
  if (_stopListener) {
    try { _stopListener(); } catch {}
    _stopListener = null;
  }
  if (_listenTimer) {
    clearTimeout(_listenTimer);
    _listenTimer = null;
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

  if (!isAdmin(senderID)) {
    return;
  }

  const parts = body.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  const commands = getCommands();
  const cmd = commands.get(commandName);
  if (!cmd) return;

  if (cmd.adminOnly && !isAdmin(senderID)) {
    api.sendMessage("This command is restricted to bot admins.", event.threadID!);
    return;
  }

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

function startPolling(api: FcaApi, attempt = 1): void {
  const MAX = 3;
  log.info(`Starting HTTP Long-Poll (attempt ${attempt}/${MAX})...`);
  let started = false;

  const stop = api.listen((err, event) => {
    if (err) {
      const msg = String((err as any).error ?? (err as any).message ?? err);
      log.error(`Poll error: ${msg}`);
      if (attempt < MAX) {
        setTimeout(() => startPolling(api, attempt + 1), attempt * 8000);
      } else {
        state.status = "error";
        state.errorMessage = "Max reconnect attempts reached";
      }
      return;
    }
    if (!started) {
      started = true;
      state.connectionType = "long-poll";
      log.ok(`Long-Poll active — UID: ${api.getCurrentUserID()}`);
    }
    handleEvent(api, event);
  });
  _stopListener = stop;
}

function startMqtt(api: FcaApi, attempt = 1): void {
  const MAX = 4;
  log.info(`MQTT connecting (attempt ${attempt}/${MAX})...`);
  let mqttOk = false;

  const timer = setTimeout(() => {
    if (!mqttOk) {
      log.warn("MQTT timeout — falling back to Long-Poll");
      startPolling(api);
    }
  }, 22000);
  _listenTimer = timer;

  const listenFn = api.listenMqtt ?? api.listen;
  const stop = listenFn.call(api, (err: any, event: FcaEvent) => {
    if (err) {
      clearTimeout(timer);
      const msg = String(err?.error ?? err?.message ?? err?.type ?? err);
      log.warn(`MQTT error: ${msg} (${attempt}/${MAX})`);
      if (attempt < MAX) {
        setTimeout(() => startMqtt(api, attempt + 1), Math.min(attempt * 8000, 40000));
      } else {
        startPolling(api);
      }
      return;
    }
    if (!mqttOk) {
      mqttOk = true;
      clearTimeout(timer);
      _listenTimer = null;
      state.connectionType = "mqtt";
      log.ok(`MQTT connected — UID: ${api.getCurrentUserID()}`);
    }
    handleEvent(api, event);
  });
  if (stop) _stopListener = stop;
  else { clearTimeout(timer); startPolling(api); }
}

export async function startBot(): Promise<void> {
  if (_loginLock) {
    log.warn("Login already in progress — ignoring");
    return;
  }
  _loginLock = true;
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }

  stopListening();
  state.api = null;
  state.uid = null;
  state.botName = null;
  state.status = "connecting";
  state.errorMessage = null;
  state.connectionType = null;

  loadCommands();

  const cookies = loadCookies();
  if (!cookies) {
    log.error("No cookies found — upload them via the panel");
    state.status = "offline";
    state.errorMessage = "No cookies — upload via panel";
    _loginLock = false;
    return;
  }

  if (!validateCookies(cookies)) {
    log.error("Invalid cookies — missing c_user or xs");
    state.status = "error";
    state.errorMessage = "Invalid cookies (missing c_user or xs)";
    _loginLock = false;
    return;
  }

  // URL-decode cookie values and normalise domain format
  const normalizedCookies = cookies.map((c) => ({
    ...c,
    value: (() => { try { return decodeURIComponent(c.value); } catch { return c.value; } })(),
    domain: c.domain?.startsWith(".") ? c.domain : `.${c.domain}`,
  }));

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

    const UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    fcaLogin(
      { appState: normalizedCookies },
      {
        logLevel: "silent",
        selfListen: false,
        listenEvents: false,
        forceLogin: false,
        userAgent: UA,
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

        try {
          const appState = (api as any).getAppState?.() as any[];
          if (appState?.length) {
            saveCookies(appState, true);
          }
        } catch {}

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

        if (typeof api.listenMqtt === "function") {
          startMqtt(api);
        } else {
          startPolling(api);
        }
      }
    );
  }

  tryLogin();
}

export function stopBot(): void {
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
    if (state.status === "offline" || state.status === "error") return;
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
