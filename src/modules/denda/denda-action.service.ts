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
    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN") || roles.includes("BRANCH BUILDING COORDINATOR") || roles.includes("COORDINATOR");
};

export const canApproveDendaAction = (user?: AuthenticatedUser | null): boolean => {
    if (!user) return false;
    const roles = userRolesText(user);
    return roles.includes("SUPER HUMAN") || roles.includes("BRANCH MANAGER");
};

export const dendaActionService = {
    ensureSchema: () => dendaActionRepository.ensureSchema(),

    async listKontraktor(user?: AuthenticatedUser) {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listKontraktor(user);
    },

    async listCandidates(cabang_array?: string[]) {
        await dendaActionRepository.ensureSchema();
        return dendaActionRepository.listCandidates(cabang_array);
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
        
        let target = undefined;
        let effectiveKontraktor = input.action_type === "SP" && input.alasan_sp === "MANIPULASI" ? input.nama_kontraktor : null;
        let tokoId = (input as any).id_toko;
        
        if (tokoId) {
            target = await dendaActionRepository.findTargetByTokoId(tokoId);
            if (!target) {
                throw new AppError("Data target SP tidak ditemukan, sudah selesai, atau belum memiliki kontraktor.", 404);
            }
            effectiveKontraktor = target.nama_kontraktor;
        } else if (input.action_type === "TAKEOVER" && input.id_opname_final) {
            target = await dendaActionRepository.findTargetByOpnameFinalId(input.id_opname_final);
             if (!target) {
                throw new AppError("Data target Takeover tidak ditemukan, sudah selesai, atau belum memiliki kontraktor.", 404);
            }
        }

        if (input.action_type === "TAKEOVER" && target && target.hari_denda < DENDA_ACTION_THRESHOLD_DAYS) {
            throw new AppError(
                `Takeover hanya dapat diajukan mulai ${DENDA_ACTION_THRESHOLD_DAYS} hari denda.`,
                409
            );
        }

        const stats = tokoId ? await dendaActionRepository.getActionStatsByTokoId(tokoId) : { active_sp_count: 0, pending_approval_count: 0 };
        
        // If it's manipulasi without toko, we might want to check contractor level stats in the future, 
        // but for now, we just rely on the toko stats if id_toko is provided.
        if (stats.pending_approval_count > 0) {
            throw new AppError("Masih ada pengajuan SP/Takeover yang menunggu approval manager.", 409);
        }

        if (input.action_type === "SP") {
            if (stats.active_sp_count >= 3 && tokoId) {
                throw new AppError("SP aktif sudah mencapai maksimal 3. Tunggu masa aktif SP berakhir atau gunakan opsi lain.", 409);
            }

            const expectedLevel = input.id_toko ? stats.active_sp_count + 1 : 1;
            if (input.id_toko && input.sp_level !== expectedLevel) {
                throw new AppError(`SP berikutnya harus SP ke-${expectedLevel}.`, 409);
            }

            const uploadedUrl = input.attachment
                ? await uploadSpAttachmentToDrive(input.attachment, {
                    nomor_ulok: target?.nomor_ulok ?? "MANIPULASI",
                    nama_kontraktor: effectiveKontraktor,
                    sp_level: input.sp_level,
                })
                : null;
            const lampiranUrl = uploadedUrl ?? input.lampiran_1_url?.trim() ?? null;
            if (!lampiranUrl) {
                throw new AppError("Lampiran pendukung Surat Peringatan wajib diupload.", 400);
            }

            return dendaActionRepository.createAction({
                target: target || undefined,
                id_toko: input.id_toko ?? undefined,
                nama_kontraktor: effectiveKontraktor ?? undefined,
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
            target: target || undefined,
            id_toko: (input as any).id_toko ?? undefined,
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

        let linkPdf: string | null = null;
        let nomorSurat: string | null = null;

        if (current.action_type === "SP") {
            nomorSurat = `SP-${current.sp_level}/${current.cabang || 'HO'}/${new Date().getFullYear()}/${current.id}`;
            
            // Build PDF buffer
            const { buildSuratPeringatanPdfBuffer } = await import("./denda-action.pdf");
            
            // Find toko name if id_toko exists
            let tokoNama = "-";
            if (current.id_toko) {
                const target = await dendaActionRepository.findTargetByTokoId(current.id_toko);
                tokoNama = target ? "Toko" : "-"; // actually target doesn't return nama_toko. That's fine, we will just use nomor_ulok
            }

            const approvedAt = new Date().toISOString();
            const pdfBuffer = await buildSuratPeringatanPdfBuffer({
                action: { ...current, nomor_surat: nomorSurat, manager_approved_at: approvedAt },
                tokoNama: tokoNama,
                approvedBy: input.actor?.nama_lengkap ?? actorEmail(input.actor) ?? "-",
                approvedRole: actorRole(input.actor) ?? "MANAGER",
                approvedAt: approvedAt,
                submittedBy: current.submitted_by_email ?? "-",
            });

            const safeUlok = sanitizeFilenamePart(current.nomor_ulok, "ULOK");
            const safeKontraktor = sanitizeFilenamePart(current.nama_kontraktor, "KONTRAKTOR");
            const filename = `SURAT_PERINGATAN_SP${current.sp_level}_${safeUlok}_${safeKontraktor}_${Date.now()}.pdf`;

            const gp = GoogleProvider.instance;
            const drive = gp.spartaDrive;
            if (drive) {
                const result = await gp.uploadFile(
                    env.PDF_STORAGE_FOLDER_ID,
                    filename,
                    "application/pdf",
                    pdfBuffer,
                    2,
                    drive
                );
                linkPdf = result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
            }
        }

        const updated = await dendaActionRepository.approveAction({
            id: input.id,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
            nomor_surat: nomorSurat,
            link_pdf: linkPdf,
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
