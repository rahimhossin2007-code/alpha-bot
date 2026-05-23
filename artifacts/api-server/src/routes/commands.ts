import { Router } from "express";
import { getCommandList, reloadCommands } from "../bot/commandLoader.js";
import { createLogger } from "../bot/logStore.js";

const log = createLogger("CMD-API");
const router = Router();

router.get("/commands", (_req, res) => {
  const commands = getCommandList().map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    aliases: cmd.aliases ?? [],
    adminOnly: cmd.adminOnly ?? true,
  }));
  res.json(commands);
});

router.post("/commands/reload", (_req, res) => {
  const result = reloadCommands();
  log.ok(`Commands reloaded: ${result.count} command(s) [${result.names.join(", ")}]`);
  res.json({
    success: true,
    message: `Reloaded ${result.count} command(s): ${result.names.join(", ") || "none"}`,
  });
});

export default router;
