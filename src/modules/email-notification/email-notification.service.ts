import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { renderHtmlTemplate, resolveTemplatePath } from "../../common/html-pdf";
import { env } from "../../config/env";
import { userCabangRepository } from "../user-cabang/user-cabang.repository";
import type { SendEmailNotificationInput } from "./email-notification.schema";

const TEMPLATE_MAP: Record<string, { template: string; subject: string }> = {
    "send-notification-spk": {
        template: "send-notification-spk.njk",
        subject: "Notifikasi SPK"
    }
};

const formatJakartaTimestamp = () => {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(new Date());
};

const buildRawEmail = (input: { from: string; to: string; subject: string; html: string }) => {
    const encodedHtml = Buffer.from(input.html, "utf-8").toString("base64");
    const message = [
        `From: ${input.from}`,
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=\"UTF-8\"",
        "Content-Transfer-Encoding: base64",
        "",
        encodedHtml
    ].join("\r\n");

    return Buffer.from(message, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

export const emailNotificationService = {
    async send(payload: SendEmailNotificationInput) {
        const templateConfig = TEMPLATE_MAP[payload.flag];
        if (!templateConfig) {
            throw new AppError(`Template email untuk flag ${payload.flag} tidak ditemukan`, 400);
        }

        const targetUser = await userCabangRepository.findByCabangAndJabatan(
            payload.cabang,
            "Branch Manager"
        );
        if (!targetUser) {
            throw new AppError("Branch Manager untuk cabang tersebut tidak ditemukan", 404);
        }

        if (!env.EMAIL_USER) {
            throw new AppError("EMAIL_USER belum diset", 500);
        }

        const templatePath = await resolveTemplatePath(templateConfig.template);
        const html = await renderHtmlTemplate(templatePath, {
            cabang: payload.cabang,
            flag: payload.flag,
            sent_at: formatJakartaTimestamp()
        });

        const gp = GoogleProvider.instance;
        const gmail = gp.spartaGmail;
        if (!gmail) {
            throw new AppError("Google Gmail belum terkonfigurasi", 500);
        }

        const raw = buildRawEmail({
            from: env.EMAIL_USER,
            to: targetUser.email_sat,
            subject: templateConfig.subject,
            html
        });

        const result = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw }
        });

        return {
            message_id: result.data.id ?? null,
            cabang: payload.cabang,
            flag: payload.flag,
            to: targetUser.email_sat,
            subject: templateConfig.subject
        };
    }
};
