import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { renderHtmlTemplate, resolveTemplatePath } from "../../common/html-pdf";
import { env } from "../../config/env";
import { userCabangRepository } from "../user-cabang/user-cabang.repository";
import type { SendEmailNotificationInput } from "./email-notification.schema";

type EmailTemplateConfig = {
    template: string;
    subject: string;
    targetJabatan: string;
    ccJabatan?: string;
};

const TEMPLATE_MAP: Record<string, EmailTemplateConfig> = {
    "send-notification-spk": {
        template: "send-notification-spk.njk",
        subject: "SPARTA Building - Notifikasi Approval SPK",
        targetJabatan: "Branch Manager",
        ccJabatan: "BRANCH BUILDING & MAINTENANCE MANAGER"
    },
    "notification-spk-has-approve": {
        template: "send-notification-spk-has-approve.njk",
        subject: "SPARTA Building - SPK Disetujui",
        targetJabatan: "KONTRAKTOR"
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

const getJakartaHour = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        hour12: false
    }).formatToParts(new Date());
    const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
    return Number(hourPart);
};

const getFormalGreeting = () => {
    const hour = getJakartaHour();
    if (hour >= 4 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
};

const wrapBase64 = (value: string, lineLength = 76) => {
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += lineLength) {
        chunks.push(value.slice(index, index + lineLength));
    }
    return chunks.join("\r\n");
};

const buildRawEmail = (input: { from: string; to: string; cc?: string; subject: string; html: string }) => {
    const encodedHtml = wrapBase64(Buffer.from(input.html, "utf-8").toString("base64"));
    const message = [
        `From: ${input.from}`,
        `To: ${input.to}`,
        input.cc ? `Cc: ${input.cc}` : null,
        `Subject: ${input.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=\"UTF-8\"",
        "Content-Transfer-Encoding: base64",
        "",
        encodedHtml
    ]
        .filter((line) => line !== null)
        .join("\r\n");

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
            templateConfig.targetJabatan
        );
        if (!targetUser) {
            throw new AppError(
                `User dengan jabatan "${templateConfig.targetJabatan}" untuk cabang tersebut tidak ditemukan`,
                404
            );
        }

        const ccUser = templateConfig.ccJabatan
            ? await userCabangRepository.findByCabangAndJabatan(payload.cabang, templateConfig.ccJabatan)
            : null;

        if (!env.EMAIL_USER) {
            throw new AppError("EMAIL_USER belum diset", 500);
        }

        const templatePath = await resolveTemplatePath(templateConfig.template);
        const html = await renderHtmlTemplate(templatePath, {
            cabang: payload.cabang,
            flag: payload.flag,
            sent_at: formatJakartaTimestamp(),
            greeting: getFormalGreeting(),
            nama_lengkap: targetUser.nama_lengkap?.trim() || templateConfig.targetJabatan
        });

        const gp = GoogleProvider.instance;
        const gmail = gp.spartaGmail;
        if (!gmail) {
            throw new AppError("Google Gmail belum terkonfigurasi", 500);
        }

        const ccEmail = ccUser?.email_sat && ccUser.email_sat !== targetUser.email_sat
            ? ccUser.email_sat
            : undefined;

        const raw = buildRawEmail({
            from: env.EMAIL_USER,
            to: targetUser.email_sat,
            cc: ccEmail,
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
            cc: ccEmail ?? null,
            subject: templateConfig.subject
        };
    }
};
