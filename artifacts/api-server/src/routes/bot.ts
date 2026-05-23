import { Router } from "express";
import { getBotState, getUptimeSeconds, startBot, stopBot, restartBot } from "../bot/index.js";
import { getStats } from "../bot/statsTracker.js";
import { getAdminCount } from "../bot/adminSystem.js";
import { getCommandList } from "../bot/commandLoader.js";

const router = Router();

router.get("/bot/status", (_req, res) => {
  const s = getBotState();
  const uptimeSeconds = getUptimeSeconds();
  res.json({
    status: s.status,
    uid: s.uid,
    botName: s.botName,
    uptimeSeconds,
    startTime: s.startTime?.toISOString() ?? null,
    errorMessage: s.errorMessage,
    connectionType: s.connectionType,
    prefix: process.env["BOT_PREFIX"] ?? "/",
  });
});

router.post("/bot/start", async (_req, res) => {
  const s = getBotState();
  if (s.status === "connecting") {
    res.json({ success: false, message: "Bot is already connecting" });
    return;
  }
  if (s.status === "online") {
    res.json({ success: false, message: "Bot is already online" });
    return;
  }
  startBot().catch(() => {});
  res.json({ success: true, message: "Bot start initiated" });
});

router.post("/bot/stop", (_req, res) => {
  stopBot();
  res.json({ success: true, message: "Bot stopped" });
});

router.post("/bot/restart", (_req, res) => {
  restartBot();
  res.json({ success: true, message: "Bot restart initiated" });
});

router.get("/bot/stats", (_req, res) => {
  const stats = getStats();
  const commands = getCommandList();
  res.json({
    messagesHandled: stats.messagesHandled,
    commandsExecuted: stats.commandsExecuted,
    adminCount: getAdminCount(),
    commandCount: commands.length,
    uptimeSeconds: getUptimeSeconds(),
    errorsCount: stats.errorsCount,
  });
});

export default router;
