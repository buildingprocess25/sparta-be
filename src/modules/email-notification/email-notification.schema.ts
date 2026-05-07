import { z } from "zod";

export const sendEmailNotificationSchema = z.object({
    cabang: z.string().trim().min(1),
    flag: z.string().trim().min(1)
});

export type SendEmailNotificationInput = z.infer<typeof sendEmailNotificationSchema>;
