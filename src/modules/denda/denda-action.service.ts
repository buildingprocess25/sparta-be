import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { dendaActionRepository } from "./denda-action.repository";
import type { CreateDendaActionInput, ListDendaActionsQuery, RejectDendaActionInput } from "./denda-action.schema";
import { DENDA_ACTION_THRESHOLD_DAYS } from "./denda-keterlambatan";

export type UploadedDendaActionAttachment = {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
};

const normalizeText = (value: unknown): string =>
    String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

const userRolesText = (user?: AuthenticatedUser | null): string =>
    [user?.jabatan, ...(user?.roles ?? [])].map(normalizeText).filter(Boolean).join(" ");

const actorEmail = (user?: AuthenticatedUser | null): string | null => user?.email_sat ?? null;
const actorRole = (user?: AuthenticatedUser | null): string | null => user?.jabatan ?? user?.roles?.join(", ") ?? null;

const sanitizeFilenamePart = (value: string | null | undefined, fallback: string): string => {
    const normalized = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedDendaActionAttachment): string => {
    const rawName = file.originalname ?? "";
    const lastDot = rawName.lastIndexOf(".");
    const fromName = lastDot > 0 && lastDot < rawName.length - 1 ? rawName.slice(lastDot).toLowerCase() : "";
    if (/^\.[a-z0-9]{1,10}$/.test(fromName)) return fromName;
    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const uploadSpAttachmentToDrive = async (
    file: UploadedDendaActionAttachment,
    context: { nomor_ulok?: string | null; nama_kontraktor?: string | null; sp_level?: number | null }
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const safeUlok = sanitizeFilenamePart(context.nomor_ulok, "ULOK");
    const safeKontraktor = sanitizeFilenamePart(context.nama_kontraktor, "KONTRAKTOR");
    const safeLevel = context.sp_level ? `SP${context.sp_level}` : "SP";
    const filename = `SURAT_PERINGATAN_LAMPIRAN_${safeLevel}_${safeUlok}_${safeKontraktor}_${Date.now()}${resolveFileExtension(file)}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive,
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
};

export const canSubmitDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;

    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN")
        || roles.includes("KOORDINATOR")
        || roles.includes("COORDINATOR");
};

export const canApproveDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;

    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN")
        || roles.includes("REGIONAL MANAGER")
        || roles.includes("GENERAL MANAGER")
        || roles.includes("SYSTEM MANAGER")
        || roles.includes("MANAGER");
};

export const dendaActionService = {
    ensureSchema: () => dendaActionRepository.ensureSchema(),

    async listCandidates() {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listCandidates();
    },

    async listActions(query: ListDendaActionsQuery) {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listActions(query);
    },

    async createAction(input: CreateDendaActionInput & {
        actor?: AuthenticatedUser | null;
        attachment?: UploadedDendaActionAttachment;
    }) {
        if (!canSubmitDendaAction(input.actor)) {
            throw new AppError("Hanya koordinator atau user berwenang yang dapat mengajukan SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const target = input.action_type === "SP"
            ? await dendaActionRepository.findTargetByTokoId(input.id_toko)
            : await dendaActionRepository.findTargetByOpnameFinalId(input.id_opname_final);
        if (!target) {
            throw new AppError("Data target SP/Takeover tidak ditemukan, sudah selesai, belum memiliki kontraktor, atau termasuk HEAD OFFICE.", 404);
        }

        if (input.action_type === "TAKEOVER" && target.hari_denda < DENDA_ACTION_THRESHOLD_DAYS) {
            throw new AppError(
                `Takeover hanya dapat diajukan mulai ${DENDA_ACTION_THRESHOLD_DAYS} hari denda.`,
                409
            );
        }

        const stats = await dendaActionRepository.getActionStatsByTokoId(target.id_toko);
        if (stats.pending_approval_count > 0) {
            throw new AppError("Masih ada pengajuan SP/Takeover yang menunggu approval manager.", 409);
        }

        if (input.action_type === "SP") {
            if (stats.active_sp_count >= 3) {
                throw new AppError("SP aktif sudah mencapai maksimal 3. Tunggu masa aktif SP berakhir atau gunakan opsi lain.", 409);
            }

            const expectedLevel = stats.active_sp_count + 1;
            if (input.sp_level !== expectedLevel) {
                throw new AppError(`SP berikutnya harus SP ke-${expectedLevel}.`, 409);
            }

            const uploadedUrl = input.attachment
                ? await uploadSpAttachmentToDrive(input.attachment, {
                    nomor_ulok: target.nomor_ulok,
                    nama_kontraktor: target.nama_kontraktor,
                    sp_level: input.sp_level,
                })
                : null;
            const lampiranUrl = uploadedUrl ?? input.lampiran_1_url?.trim() ?? null;
            if (!lampiranUrl) {
                throw new AppError("Lampiran pendukung Surat Peringatan wajib diupload.", 400);
            }

            return dendaActionRepository.createAction({
                target,
                action_type: input.action_type,
                sp_level: input.sp_level,
                alasan_sp: input.alasan_sp,
                catatan: input.catatan,
                lampiran_1_url: lampiranUrl,
                lampiran_2_url: input.lampiran_2_url,
                actor_email: actorEmail(input.actor),
                actor_role: actorRole(input.actor),
            });
        }

        return dendaActionRepository.createAction({
            target,
            action_type: input.action_type,
            catatan: input.catatan,
            lampiran_1_url: input.lampiran_1_url,
            lampiran_2_url: input.lampiran_2_url,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
    },

    async approveAction(input: { id: number; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat approve SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const current = await dendaActionRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        const updated = await dendaActionRepository.approveAction({
            id: input.id,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        return updated;
    },

    async rejectAction(input: { id: number; payload: RejectDendaActionInput; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat reject SP/Takeover.", 403);
        }

        await dendaActionRepository.ensureSchema();
        const current = await dendaActionRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        const updated = await dendaActionRepository.rejectAction({
            id: input.id,
            reason: input.payload.alasan_penolakan,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        return updated;
    },
};
