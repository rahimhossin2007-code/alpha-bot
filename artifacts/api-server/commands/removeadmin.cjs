"use strict";

module.exports = {
  name: "removeadmin",
  description: "Remove a user from bot admins. Usage: /removeadmin <uid>",
  aliases: ["ra", "deladmin"],
  adminOnly: true,
  execute(api, event, args, ctx) {
    const uid = args[0];
    if (!uid) {
      api.sendMessage("Usage: /removeadmin <uid>", event.threadID);
      return;
    }
    if (uid === event.senderID) {
      api.sendMessage("You cannot remove yourself.", event.threadID);
      return;
    }
    const removed = (() => {
      try {
        ctx.removeAdmin(uid);
        return true;
      } catch { return false; }
    })();
    if (removed) {
      api.sendMessage(`Removed ${uid} from bot admins.`, event.threadID);
    } else {
      api.sendMessage(`User ${uid} is not an admin.`, event.threadID);
    }
  },
};
