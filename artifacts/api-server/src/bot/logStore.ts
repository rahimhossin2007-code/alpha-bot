export interface LogEntry {
  id: number;
  level: string;
  tag: string | null;
  message: string;
  timestamp: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];
let nextId = 1;

export function addLog(level: string, tag: string | null, message: string): void {
  const entry: LogEntry = {
    id: nextId++,
    level,
    tag,
    message,
    timestamp: new Date().toISOString(),
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function getLogs(limit = 100, level?: string): LogEntry[] {
  let result = logs;
  if (level) {
    result = logs.filter((l) => l.level.toLowerCase() === level.toLowerCase());
  }
  return result.slice(-limit);
}

export function createLogger(tag: string) {
  return {
    info: (msg: string) => {
      addLog("INFO", tag, msg);
      console.log(`[${tag}] ${msg}`);
    },
    warn: (msg: string) => {
      addLog("WARN", tag, msg);
      console.warn(`[${tag}] ${msg}`);
    },
    error: (msg: string) => {
      addLog("ERROR", tag, msg);
      console.error(`[${tag}] ${msg}`);
    },
    ok: (msg: string) => {
      addLog("OK", tag, msg);
      console.log(`[${tag}] ✓ ${msg}`);
    },
    debug: (msg: string) => {
      addLog("DEBUG", tag, msg);
    },
  };
}
