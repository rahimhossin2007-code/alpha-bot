import path from "path";
import { DATA_DIR, readJson, writeJson } from "./dataDir.js";
import type { AdminEntry } from "./types.js";

const ADMINS_FILE = path.join(DATA_DIR, "admins.json");

function loadAdmins(): AdminEntry[] {
  return readJson<AdminEntry[]>(ADMINS_FILE, []);
}

function saveAdmins(admins: AdminEntry[]): void {
  writeJson(ADMINS_FILE, admins);
}

export function getAdmins(): AdminEntry[] {
  return loadAdmins();
}

export function isAdmin(uid: string): boolean {
  const admins = loadAdmins();
  return admins.some((a) => a.uid === uid);
}

export function addAdmin(uid: string, name?: string | null): AdminEntry {
  const admins = loadAdmins();
  const existing = admins.find((a) => a.uid === uid);
  if (existing) {
    if (name !== undefined) existing.name = name ?? null;
    saveAdmins(admins);
    return existing;
  }
  const entry: AdminEntry = {
    uid,
    name: name ?? null,
    addedAt: new Date().toISOString(),
  };
  admins.push(entry);
  saveAdmins(admins);
  return entry;
}

export function removeAdmin(uid: string): boolean {
  const admins = loadAdmins();
  const idx = admins.findIndex((a) => a.uid === uid);
  if (idx === -1) return false;
  admins.splice(idx, 1);
  saveAdmins(admins);
  return true;
}

export function getAdminCount(): number {
  return loadAdmins().length;
}
