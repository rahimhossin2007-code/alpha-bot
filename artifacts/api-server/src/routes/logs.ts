import { Router } from "express";
import { getLogs } from "../bot/logStore.js";
import { GetLogsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/logs", (req, res) => {
  const result = GetLogsQueryParams.safeParse(req.query);
  const limit = result.success ? (result.data.limit ?? 100) : 100;
  const level = result.success ? result.data.level : undefined;
  res.json(getLogs(limit, level));
});

export default router;
