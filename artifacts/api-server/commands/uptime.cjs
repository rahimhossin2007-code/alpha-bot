"use strict";

module.exports = {
  name: "uptime",
  description: "Show how long the bot has been running",
  aliases: ["up"],
  adminOnly: true,
  execute(api, event, _args, ctx) {
    const seconds = Math.floor((Date.now() - ctx.startTime.getTime()) / 1000);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    api.sendMessage(
      `ALPHA Bot uptime: ${parts.join(" ")}`,
      event.threadID
    );
  },
};
