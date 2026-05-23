import { Router } from "express";
import { getAdmins, addAdmin, removeAdmin } from "../bot/adminSystem.js";
import { AddAdminBody, RemoveAdminParams } from "@workspace/api-zod";

const router = Router();

router.get("/admins", (_req, res) => {
  res.json(getAdmins());
});

router.post("/admins", (req, res) => {
  const result = AddAdminBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  const { uid, name } = result.data;
  const admin = addAdmin(uid, name);
  res.status(201).json(admin);
});

router.delete("/admins/:uid", (req, res) => {
  const result = RemoveAdminParams.safeParse(req.params);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  const { uid } = result.data;
  const removed = removeAdmin(uid);
  if (!removed) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  res.json({ success: true, message: `Admin ${uid} removed` });
});

export default router;
