import path from "path";
import fs from "fs";

export const DATA_DIR =
  process.env["BOT_DATA_DIR"] ??
  path.resolve(process.cwd(), "data");

export const COMMANDS_DIR =
  process.env["BOT_COMMANDS_DIR"] ??
  path.resolve(process.cwd(), "commands");

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMMANDS_DIR)) {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
  }
}

export function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content || content === "null") return defaultValue;
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}
