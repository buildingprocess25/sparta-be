import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { taskNotificationRepository } from "./task-notification.repository";

export const getTaskNotifications = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            status: "error",
            message: "Sesi tidak valid atau sudah berakhir."
        });
        return;
    }

    const groups = await taskNotificationRepository.getGroups(user);

    res.json({
        status: "success",
        data: {
            total: groups.reduce((sum, group) => sum + group.count, 0),
            groups
        }
    });
});
