"use strict";

module.exports = {
  name: "ping",
  description: "Check if the bot is alive",
  aliases: ["p"],
  adminOnly: true,
  execute(api, event, _args, _ctx) {
    const start = Date.now();
    api.sendMessage("Pong!", event.threadID, (err) => {
      if (!err) {
        const latency = Date.now() - start;
        api.sendMessage(`Latency: ${latency}ms`, event.threadID);
      }
    });
  },
};
