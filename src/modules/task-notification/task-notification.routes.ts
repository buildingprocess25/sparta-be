import { Router } from "express";
import { getTaskNotifications } from "./task-notification.controller";

const taskNotificationRouter = Router();

taskNotificationRouter.get("/", getTaskNotifications);

export { taskNotificationRouter };
