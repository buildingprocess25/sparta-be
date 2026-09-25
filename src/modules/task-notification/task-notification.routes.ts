import { Router } from "express";
import { getTaskNotifications, getVapidPublicKey, subscribeToWebPush, testWebPush } from "./task-notification.controller";

const taskNotificationRouter = Router();

taskNotificationRouter.get("/", getTaskNotifications);
taskNotificationRouter.get("/web-push/vapid-public-key", getVapidPublicKey);
taskNotificationRouter.post("/web-push/subscribe", subscribeToWebPush);
taskNotificationRouter.get("/web-push/test-trigger", testWebPush);

export { taskNotificationRouter };
