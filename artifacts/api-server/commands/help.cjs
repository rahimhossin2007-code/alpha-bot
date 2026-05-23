"use strict";
const path = require("path");
const fs = require("fs");

module.exports = {
  name: "help",
  description: "List all available commands",
  aliases: ["h", "?"],
  adminOnly: true,
  execute(api, event, args, ctx) {
    const cmdDir = process.env.BOT_COMMANDS_DIR
      || path.resolve(process.cwd(), "commands");

    let commands = [];
    try {
      commands = fs.readdirSync(cmdDir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => {
          try {
            const mod = require(path.join(cmdDir, f));
            return mod && mod.name ? mod : null;
          } catch { return null; }
        })
        .filter(Boolean);
    } catch {}

    if (args[0]) {
      const cmd = commands.find(
        (c) => c.name === args[0].toLowerCase() ||
          (c.aliases || []).includes(args[0].toLowerCase())
      );
      if (!cmd) {
        api.sendMessage(`Command "${args[0]}" not found.`, event.threadID);
        return;
      }
      const aliases = cmd.aliases?.length ? `\nAliases: ${ctx.prefix}${cmd.aliases.join(`, ${ctx.prefix}`)}` : "";
      api.sendMessage(
        `${ctx.prefix}${cmd.name}\n${cmd.description}${aliases}`,
        event.threadID
      );
      return;
    }

    const lines = commands.map(
      (c) => `${ctx.prefix}${c.name} — ${c.description}`
    );
    api.sendMessage(
      `ALPHA Bot Commands (${commands.length}):\n\n${lines.join("\n")}`,
      event.threadID
    );
  },
};
