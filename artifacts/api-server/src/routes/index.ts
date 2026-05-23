import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import botRouter from "./bot.js";
import adminsRouter from "./admins.js";
import cookieRouter from "./cookie.js";
import logsRouter from "./logs.js";
import commandsRouter from "./commands.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(botRouter);
router.use(adminsRouter);
router.use(cookieRouter);
router.use(logsRouter);
router.use(commandsRouter);

export default router;
