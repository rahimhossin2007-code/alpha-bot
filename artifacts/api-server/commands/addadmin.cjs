"use strict";

module.exports = {
  name: "addadmin",
  description: "Add a user as bot admin. Usage: /addadmin <uid> [name]",
  aliases: ["aa"],
  adminOnly: true,
  execute(api, event, args, ctx) {
    const uid = args[0];
    if (!uid) {
      api.sendMessage("Usage: /addadmin <uid> [name]", event.threadID);
      return;
    }
    const name = args.slice(1).join(" ") || null;
    ctx.addAdmin(uid, name);
    api.sendMessage(
      `Added ${name ? name : uid} (${uid}) as bot admin.`,
      event.threadID
    );
  },
};
