import path from "path";
import fs from "fs";
import { COMMANDS_DIR } from "./dataDir.js";
import type { BotCommand } from "./types.js";
import { createLogger } from "./logStore.js";

const log = createLogger("CMD");

const commandMap = new Map<string, BotCommand>();

function getRequire() {
  try {
    const { createRequire } = require("module");
    return createRequire(path.join(COMMANDS_DIR, "__synthetic__.js"));
  } catch {
    return require;
  }
}

function loadFile(filePath: string): BotCommand | null {
  try {
    const req = getRequire();
    if (req.cache) delete req.cache[filePath];
    const mod = req(filePath) as BotCommand;
    if (!mod || !mod.name || typeof mod.execute !== "function") {
      log.warn(`Skipping ${path.basename(filePath)}: missing name or execute`);
      return null;
    }
    return mod;
  } catch (err: any) {
    log.error(`Failed to load ${path.basename(filePath)}: ${err?.message}`);
    return null;
  }
}

export function loadCommands(): Map<string, BotCommand> {
  commandMap.clear();
  if (!fs.existsSync(COMMANDS_DIR)) {
    log.warn(`Commands directory not found: ${COMMANDS_DIR}`);
    return commandMap;
  }
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".cjs") || f.endsWith(".js"));
  let loaded = 0;
  for (const file of files) {
    const filePath = path.join(COMMANDS_DIR, file);
    const cmd = loadFile(filePath);
    if (!cmd) continue;
    commandMap.set(cmd.name.toLowerCase(), cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        commandMap.set(alias.toLowerCase(), cmd);
      }
    }
    loaded++;
  }
  log.ok(`Loaded ${loaded} command(s) from ${COMMANDS_DIR}`);
  return commandMap;
}

export function reloadCommands(): { count: number; names: string[] } {
  loadCommands();
  const unique = new Set<string>();
  for (const cmd of commandMap.values()) unique.add(cmd.name);
  return { count: unique.size, names: Array.from(unique) };
}

export function getCommands(): Map<string, BotCommand> {
  return commandMap;
}

export function getCommandList(): BotCommand[] {
  const seen = new Set<string>();
  const result: BotCommand[] = [];
  for (const cmd of commandMap.values()) {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name);
      result.push(cmd);
    }
  }
  return result;
}
