export interface FcaApi {
  listen: (callback: (err: any, event: FcaEvent) => void) => () => void;
  listenMqtt?: (callback: (err: any, event: FcaEvent) => void) => () => void;
  sendMessage: (msg: string | FcaMessage, threadID: string, callback?: (err: any, info: any) => void) => void;
  getCurrentUserID: () => string;
  getUserInfo: (ids: string | string[], callback: (err: any, info: Record<string, FcaUserInfo>) => void) => void;
  setOptions: (opts: Record<string, any>) => void;
  logout: (callback?: (err: any) => void) => void;
}

export interface FcaMessage {
  body?: string;
  attachment?: any;
  mentions?: Array<{tag: string; id: string; fromIndex?: number}>;
}

export interface FcaEvent {
  type: string;
  body?: string;
  senderID?: string;
  threadID?: string;
  messageID?: string;
  attachments?: any[];
  isGroup?: boolean;
  mentions?: Record<string, string>;
  timestamp?: number;
}

export interface FcaUserInfo {
  name: string;
  firstName?: string;
  vanity?: string;
  profileUrl?: string;
  gender?: string;
  type?: string;
  isFriend?: boolean;
  isBirthday?: boolean;
  searchTokens?: string[];
  alternateName?: string;
}

export interface CookieEntry {
  key: string;
  value: string;
  domain?: string;
  path?: string;
  hostOnly?: boolean;
  creation?: string;
  lastAccessed?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

export interface BotCommand {
  name: string;
  description: string;
  aliases?: string[];
  adminOnly?: boolean;
  execute: (api: FcaApi, event: FcaEvent, args: string[], ctx: CommandContext) => Promise<void> | void;
}

export interface CommandContext {
  isAdmin: (uid: string) => boolean;
  addAdmin: (uid: string, name?: string) => void;
  removeAdmin: (uid: string) => void;
  getAdmins: () => AdminEntry[];
  prefix: string;
  startTime: Date;
}

export interface AdminEntry {
  uid: string;
  name: string | null;
  addedAt: string;
}

export type BotStatus = "online" | "offline" | "connecting" | "error";
