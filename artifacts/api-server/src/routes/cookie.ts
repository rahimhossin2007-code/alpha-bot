import { Router } from "express";
import { getCookieInfo, parseCookieInput, validateCookies, saveCookies } from "../bot/cookieStore.js";
import { restartBot } from "../bot/index.js";
import { UpdateCookieBody } from "@workspace/api-zod";
import { createLogger } from "../bot/logStore.js";

const log = createLogger("COOKIE-API");
const router = Router();

router.get("/cookie", (_req, res) => {
  res.json(getCookieInfo());
});

router.put("/cookie", (req, res) => {
  const result = UpdateCookieBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  const { cookie } = result.data;
  const parsed = parseCookieInput(cookie);
  if (!parsed) {
    res.status(400).json({ error: "Invalid cookie format — must be a JSON array of cookie objects" });
    return;
  }
  if (!validateCookies(parsed)) {
    res.status(400).json({ error: "Cookie is missing required fields (c_user and xs)" });
    return;
  }
  saveCookies(parsed);
  log.ok("Cookie updated via panel — triggering hot-reconnect");
  restartBot();
  res.json({ success: true, message: "Cookie updated and bot is reconnecting" });
});

export default router;
