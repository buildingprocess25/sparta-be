import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { spRepository } from "./sp.repository";
import type { CreateDendaActionInput, ListDendaActionsQuery, RejectDendaActionInput } from "./sp.schema";
// Threshold for Takeover action (in days of denda)
export const DENDA_ACTION_THRESHOLD_DAYS = 8;

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
    return roles.includes("SUPER HUMAN") || roles.includes("BRANCH BUILDING & MAINTENANCE MANAGER");
};

const buildAndUploadSpPdf = async (input: {
    action: any;
    nomorSurat: string;
    submittedBy: string;
    submittedAt?: string | null;
    approvedBy?: string | null;
    approvedRole?: string | null;
    approvedAt?: string | null;
}): Promise<string> => {
    const { buildSuratPeringatanPdfBuffer } = await import("./sp.pdf");
    const pdfBuffer = await buildSuratPeringatanPdfBuffer({
        action: { ...input.action, nomor_surat: input.nomorSurat, manager_approved_at: input.approvedAt ?? input.action.manager_approved_at },
        tokoNama: "Toko",
        approvedBy: input.approvedBy ?? null,
        approvedRole: input.approvedRole ?? null,
        approvedAt: input.approvedAt ?? null,
        submittedBy: input.submittedBy,
        submittedAt: input.submittedAt ?? input.action.submitted_at ?? input.action.created_at,
    });

    const safeUlok = sanitizeFilenamePart(input.action.nomor_ulok, "ULOK");
    const safeKontraktor = sanitizeFilenamePart(input.action.nama_kontraktor, "KONTRAKTOR");
    const filename = `SURAT_PERINGATAN_SP${input.action.sp_level}_${safeUlok}_${safeKontraktor}_${Date.now()}.pdf`;

    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        pdfBuffer,
        2,
        drive
    );
    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
};

/**
 * Lookup email kontraktor dari tabel user_cabang.
 * Match: nama_pt (perusahaan kontraktor) dengan nama_kontraktor pada SP.
 * Prioritas: cabang sama > cabang manapun.
 * Return null jika tidak ditemukan.
 */
const lookupKontraktorEmail = async (
    namaKontraktor: string,
    cabang?: string | null
): Promise<string | null> => {
    try {
        const { pool } = await import("../../db/pool");
        // Coba cabang spesifik dulu
        if (cabang) {
            const res = await pool.query<{ email_sat: string }>(
                `SELECT email_sat
                 FROM user_cabang
                 WHERE UPPER(jabatan) = 'KONTRAKTOR'
                   AND LOWER(TRIM(COALESCE(nama_pt, ''))) = LOWER(TRIM($1))
                   AND UPPER(TRIM(COALESCE(cabang, ''))) = UPPER(TRIM($2))
                 ORDER BY email_sat ASC
                 LIMIT 1`,
                [namaKontraktor, cabang]
            );
            if (res.rows[0]?.email_sat) return res.rows[0].email_sat;
        }
        // Fallback: cabang mana saja
        const res2 = await pool.query<{ email_sat: string }>(
            `SELECT email_sat
             FROM user_cabang
             WHERE UPPER(jabatan) = 'KONTRAKTOR'
               AND LOWER(TRIM(COALESCE(nama_pt, ''))) = LOWER(TRIM($1))
             ORDER BY email_sat ASC
             LIMIT 1`,
            [namaKontraktor]
        );
        return res2.rows[0]?.email_sat ?? null;
    } catch (err: any) {
        console.warn(`[SP Service] lookupKontraktorEmail error for "${namaKontraktor}":`, err?.message);
        return null;
    }
};

/**
 * Lookup nama_lengkap dari user_cabang berdasarkan email.
 * Return null jika tidak ditemukan.
 */
const lookupNamaLengkap = async (email: string | null | undefined): Promise<string | null> => {
    if (!email) return null;
    try {
        const { pool } = await import("../../db/pool");
        const res = await pool.query<{ nama_lengkap: string }>(
            `SELECT nama_lengkap
             FROM user_cabang
             WHERE LOWER(TRIM(COALESCE(email_sat, ''))) = LOWER(TRIM($1))
             LIMIT 1`,
            [email]
        );
        return res.rows[0]?.nama_lengkap?.trim() || null;
    } catch (err: any) {
        console.warn(`[SP Service] lookupNamaLengkap error for "${email}":`, err?.message);
        return null;
    }
};

export const spService = {
    ensureSchema: () => spRepository.ensureSchema(),

    async listKontraktor(user?: AuthenticatedUser) {
        await spRepository.ensureSchema();
        return spRepository.listKontraktor(user);
    },

    async listKontraktorDebug(user?: AuthenticatedUser) {
        await spRepository.ensureSchema();
        const fromProjects = await spRepository.listKontraktor(user);
        const fromUsers = await spRepository.listKontraktorFromUserCabang(user);
        
        // Merge and deduplicate
        const allKontraktor = Array.from(new Set([...fromProjects, ...fromUsers])).sort();
        
        return {
            fromProjects,
            fromUsers,
            merged: allKontraktor,
            total: {
                fromProjects: fromProjects.length,
                fromUsers: fromUsers.length,
                merged: allKontraktor.length,
            }
        };
    },

    async listCandidates(cabang_array?: string[]) {
        await spRepository.ensureSchema();
        return spRepository.listCandidates(cabang_array);
    },

    async listActions(query: ListDendaActionsQuery) {
        await spRepository.ensureSchema();
        return spRepository.listActions(query);
    },

    async listActionsForKontraktor(namaKontraktor: string) {
        await spRepository.ensureSchema();
        return spRepository.listKontraktorActions(namaKontraktor);
    },

    async createAction(input: CreateDendaActionInput & {
        actor?: AuthenticatedUser | null;
        attachment?: UploadedDendaActionAttachment;
    }) {
        if (!canSubmitDendaAction(input.actor)) {
            throw new AppError("Hanya koordinator atau user berwenang yang dapat mengajukan SP/Takeover.", 403);
        }

        await spRepository.ensureSchema();
        
        let target = undefined;
        let effectiveKontraktor = input.action_type === "SP" && (input.alasan_sp === "MANIPULASI" || input.alasan_sp === "LAINNYA") ? input.nama_kontraktor : null;
        let tokoId = (input as any).id_toko;
        const isKontraktorScope = input.action_type === "SP" && (input.alasan_sp === "MANIPULASI" || input.alasan_sp === "LAINNYA");
        
        if (tokoId) {
            target = await spRepository.findTargetByTokoId(tokoId);
            if (!target) {
                throw new AppError("Data target SP tidak ditemukan, sudah selesai, atau belum memiliki kontraktor.", 404);
            }
            effectiveKontraktor = target.nama_kontraktor;
        } else if (input.action_type === "TAKEOVER" && input.id_opname_final) {
            target = await spRepository.findTargetByOpnameFinalId(input.id_opname_final);
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

        // Ambil stats sesuai scope:
        // - MANIPULASI/LAINNYA  → cek per kontraktor (nama_kontraktor)
        // - ULOK-based          → cek per toko (id_toko)
        let stats: { active_sp_count: number; pending_approval_count: number; highest_active_sp_level: number };
        if (isKontraktorScope && effectiveKontraktor) {
            stats = await spRepository.getActionStatsByKontraktor(effectiveKontraktor);
        } else if (tokoId) {
            stats = await spRepository.getActionStatsByTokoId(tokoId);
        } else {
            stats = { active_sp_count: 0, pending_approval_count: 0, highest_active_sp_level: 0 };
        }

        // Blok jika masih ada SP yang menunggu approval manager
        if (stats.pending_approval_count > 0) {
            const scope = isKontraktorScope
                ? `kontraktor "${effectiveKontraktor}"`
                : `ULOK ini`;
            throw new AppError(
                `Masih ada pengajuan SP untuk ${scope} yang sedang menunggu persetujuan manager. Selesaikan terlebih dahulu.`,
                409
            );
        }

        if (input.action_type === "SP") {
            // Blok jika sudah 3 SP aktif
            if (stats.active_sp_count >= 3) {
                throw new AppError(
                    "SP aktif sudah mencapai maksimal 3. Tidak dapat mengajukan SP baru.",
                    409
                );
            }

            // Auto-determine SP level:
            // Jika tidak ada SP aktif, user bebas pilih SP ke-berapa (dari input FE)
            // Jika ada SP aktif, SP berikutnya adalah (highest_active_sp_level + 1)
            let autoSpLevel = stats.active_sp_count === 0
                ? (input.sp_level ?? 1)
                : (stats.highest_active_sp_level + 1);

            // Validasi maksimal tingkat SP adalah 3
            if (autoSpLevel > 3) {
                throw new AppError(
                    `SP berikutnya (SP ${autoSpLevel}) melebihi batas maksimum SP 3.`,
                    409
                );
            }

            const uploadedUrl = input.attachment
                ? await uploadSpAttachmentToDrive(input.attachment, {
                    nomor_ulok: target?.nomor_ulok ?? input.alasan_sp ?? "MANIPULASI",
                    nama_kontraktor: effectiveKontraktor,
                    sp_level: autoSpLevel,
                })
                : null;
            const lampiranUrl = uploadedUrl ?? input.lampiran_1_url?.trim() ?? null;
            if (!lampiranUrl) {
                throw new AppError("Lampiran pendukung Surat Peringatan wajib diupload.", 400);
            }

            return spRepository.createAction({
                target: target || undefined,
                id_toko: input.id_toko ?? undefined,
                nama_kontraktor: effectiveKontraktor ?? undefined,
                action_type: input.action_type,
                sp_level: autoSpLevel,
                alasan_sp: input.alasan_sp,
                alasan_lainnya: input.alasan_lainnya,
                catatan: input.catatan,
                lampiran_1_url: lampiranUrl,
                lampiran_2_url: input.lampiran_2_url,
                actor_email: actorEmail(input.actor),
                actor_name: input.actor?.nama_lengkap ?? await lookupNamaLengkap(actorEmail(input.actor)) ?? null,
                actor_role: actorRole(input.actor),
                cabang: input.actor?.cabang ?? null,
            });
        }

        return spRepository.createAction({
            target: target || undefined,
            id_toko: (input as any).id_toko ?? undefined,
            action_type: input.action_type,
            catatan: input.catatan,
            lampiran_1_url: input.lampiran_1_url,
            lampiran_2_url: input.lampiran_2_url,
            actor_email: actorEmail(input.actor),
            actor_name: input.actor?.nama_lengkap ?? await lookupNamaLengkap(actorEmail(input.actor)) ?? null,
            actor_role: actorRole(input.actor),
            cabang: (input.actor as any)?.cabang ?? null,
        });
    },

    async approveAction(input: { id: number; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat approve SP/Takeover.", 403);
        }

        await spRepository.ensureSchema();
        const current = await spRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        let linkPdf: string | null = null;
        let nomorSurat: string | null = null;

        if (current.action_type === "SP") {
            nomorSurat = `SP-${current.sp_level}/${current.cabang || 'HO'}/${new Date().getFullYear()}/${current.id}`;

            const approvedAt = new Date().toISOString();
            // Resolve nama lengkap approver (prioritaskan nama_lengkap dari session, fallback ke lookup DB)
            const approverName = input.actor?.nama_lengkap ?? await lookupNamaLengkap(actorEmail(input.actor)) ?? actorEmail(input.actor) ?? "-";
            // Resolve nama lengkap submitter dari record (sudah tersimpan saat create)
            const submitterName = current.submitted_by_name ?? await lookupNamaLengkap(current.submitted_by_email) ?? current.submitted_by_email ?? "-";

            linkPdf = await buildAndUploadSpPdf({
                action: current,
                nomorSurat,
                approvedBy: approverName,
                approvedRole: actorRole(input.actor) ?? "BRANCH BUILDING & MAINTENANCE MANAGER",
                approvedAt,
                submittedBy: submitterName,
                submittedAt: current.submitted_at ?? current.created_at,
            });
        }

        const updated = await spRepository.approveAction({
            id: input.id,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
            nomor_surat: nomorSurat,
            link_pdf: linkPdf,
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);

        // Send email to kontraktor if SP
        if (updated.action_type === "SP" && updated.nama_kontraktor) {
            try {
                await this.sendSpNotificationToKontraktor(updated);
            } catch (emailError) {
                console.error("[SP Service] Failed to send email to kontraktor:", emailError);
                // Don't fail the approval if email fails, just log
            }
        }

        return updated;
    },

    async regenerateSpPdf(input: { id: number; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor) && !canSubmitDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat me-regenerate PDF SP.", 403);
        }

        await spRepository.ensureSchema();
        const current = await spRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP tidak ditemukan.", 404);
        if (current.action_type !== "SP") {
            throw new AppError("Aksi ini hanya untuk Surat Peringatan.", 400);
        }
        if (current.status === "REJECTED_BY_MANAGER" || current.status === "EXPIRED") {
            throw new AppError("SP ditolak atau sudah tidak valid.", 400);
        }

        let nomorSurat = current.nomor_surat || `SP-${current.sp_level}/${current.cabang || 'HO'}/${new Date().getFullYear()}/${current.id}`;

        // Resolve nama lengkap untuk regenerate PDF
        const hasManagerApproval = Boolean(current.manager_approved_at);
        const approverName = hasManagerApproval ? current.manager_approved_by ?? "-" : null;
        const submitterName = current.submitted_by_name ?? await lookupNamaLengkap(current.submitted_by_email) ?? current.submitted_by_email ?? "-";

        const linkPdf = await buildAndUploadSpPdf({
            action: current,
            nomorSurat,
            approvedBy: approverName,
            approvedRole: hasManagerApproval ? current.manager_approved_role ?? "BRANCH BUILDING & MAINTENANCE MANAGER" : null,
            approvedAt: hasManagerApproval ? current.manager_approved_at : null,
            submittedBy: submitterName,
            submittedAt: current.submitted_at ?? current.created_at,
        });

        // Gunakan updatePdfLink (bukan approveAction) agar bisa update tanpa peduli status
        const updated = await spRepository.updatePdfLink({
            id: input.id,
            link_pdf: linkPdf,
            nomor_surat: nomorSurat,
        });

        return updated;
    },

    async rejectAction(input: { id: number; payload: RejectDendaActionInput; actor?: AuthenticatedUser | null }) {
        if (!canApproveDendaAction(input.actor)) {
            throw new AppError("Hanya manager atau user berwenang yang dapat reject SP/Takeover.", 403);
        }

        await spRepository.ensureSchema();
        const current = await spRepository.findActionById(input.id);
        if (!current) throw new AppError("Pengajuan SP/Takeover tidak ditemukan.", 404);
        if (current.status !== "WAITING_MANAGER") {
            throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        }

        const updated = await spRepository.rejectAction({
            id: input.id,
            reason: input.payload.alasan_penolakan,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor),
        });
        if (!updated) throw new AppError("Pengajuan ini sudah diproses manager.", 409);
        return updated;
    },

    // ===================================================================
    // EMAIL NOTIFICATION HELPER
    // ===================================================================

    async sendSpNotificationToKontraktor(action: any) {
        const gp = GoogleProvider.instance;
        const gmail = gp.spartaGmail;
        if (!gmail) {
            console.warn("[SP Service] Gmail not configured, skipping email");
            return;
        }

        // Get kontraktor email from Google Sheets
        const { renderHtmlTemplate, resolveTemplatePath } = await import("../../common/html-pdf");
        
        // Format data for template
        const getSpLevelRomawi = (level?: number | null) => {
            if (level === 1) return "I";
            if (level === 2) return "II";
            if (level === 3) return "III";
            return "-";
        };

        const getAlasanText = (alasan?: string | null) => {
            if (alasan === 'KETERLAMBATAN') return "Keterlambatan Pekerjaan";
            if (alasan === 'MENOLAK_SPK') return "Menolak SPK / Pekerjaan";
            if (alasan === 'MANIPULASI') return "Tindakan Manipulasi / Pelanggaran Berat";
            return alasan ?? "-";
        };

        const formatTanggal = (isoString?: string | null) => {
            if (!isoString) return "-";
            const d = new Date(isoString);
            if (Number.isNaN(d.getTime())) return String(isoString);
            return new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(d);
        };

        const getGreeting = () => {
            const hour = new Date().getHours();
            if (hour >= 4 && hour < 11) return "Selamat pagi";
            if (hour >= 11 && hour < 15) return "Selamat siang";
            if (hour >= 15 && hour < 18) return "Selamat sore";
            return "Selamat malam";
        };

        const frontendUrl = env.FRONTEND_URL || "https://sparta-building.vercel.app";
        const acknowledgeUrl = `${frontendUrl}/kontraktor/surat-peringatan?id=${action.id}&kontraktor=${encodeURIComponent(action.nama_kontraktor)}`;

        const templateData = {
            greeting: getGreeting(),
            nama_kontraktor: action.nama_kontraktor,
            nomor_surat: action.nomor_surat || "-",
            nomor_ulok: action.nomor_ulok,
            cabang: action.cabang || "-",
            nomor_spk: action.nomor_spk,
            sp_level_romawi: getSpLevelRomawi(action.sp_level),
            alasan_sp_text: getAlasanText(action.alasan_sp),
            catatan: action.catatan,
            tanggal_expired: formatTanggal(action.expires_at),
            acknowledge_url: acknowledgeUrl,
            pdf_url: action.link_pdf,
            sent_at: new Intl.DateTimeFormat("sv-SE", {
                timeZone: "Asia/Jakarta",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(new Date()),
        };

        const templatePath = await resolveTemplatePath("send-notification-sp-to-kontraktor.njk");
        const htmlBody = await renderHtmlTemplate(templatePath, templateData);

        // Lookup email kontraktor dari user_cabang
        const resolvedEmail = await lookupKontraktorEmail(action.nama_kontraktor, action.cabang);
        if (!resolvedEmail) {
            console.warn(`[SP Service] Email kontraktor tidak ditemukan untuk "${action.nama_kontraktor}" (cabang: ${action.cabang}). Email tidak dikirim.`);
            return;
        }
        const kontraktorEmail = resolvedEmail;
        
        const subject = `Surat Peringatan ${getSpLevelRomawi(action.sp_level)} - ${action.nama_kontraktor} - ${action.cabang}`;
        const toEmail = kontraktorEmail;

        // Build email
        const messageParts = [
            `From: SPARTA Building <no-reply@sparta-building.com>`,
            `To: ${toEmail}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=utf-8`,
            ``,
            htmlBody
        ];

        const message = messageParts.join("\r\n");
        const encodedMessage = Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        try {
            await gmail.users.messages.send({
                userId: "me",
                requestBody: { raw: encodedMessage },
            });
            console.log(`[SP Service] Email sent to kontraktor: ${toEmail}`);
        } catch (error: any) {
            console.error("[SP Service] Gmail API error:", error.message);
            throw error;
        }
    },

    // ===================================================================
    // KONTRAKTOR METHODS
    // ===================================================================

    async listKontraktorSp(namaKontraktor: string) {
        await spRepository.ensureSchema();
        const actions = await spRepository.listKontraktorActions(namaKontraktor);
        const stats = await spRepository.getKontraktorStats(namaKontraktor);
        return { actions, stats };
    },

    async getKontraktorSpDetail(input: { id: number; namaKontraktor: string; autoMarkAsViewed?: boolean }) {
        await spRepository.ensureSchema();
        const action = await spRepository.findActionByIdAndKontraktor(input.id, input.namaKontraktor);
        if (!action) {
            throw new AppError("Surat Peringatan tidak ditemukan atau tidak untuk kontraktor ini.", 404);
        }

        // Auto-mark as viewed if first time opening
        if (input.autoMarkAsViewed && action.status === 'SENT_TO_CONTRACTOR') {
            const updated = await spRepository.markAsViewedByKontraktor(input.id);
            return updated || action;
        }

        return action;
    },

    async acknowledgeKontraktorSp(input: {
        id: number;
        namaKontraktor: string;
        catatan?: string;
        actor?: AuthenticatedUser | null;
    }) {
        await spRepository.ensureSchema();
        
        // Verify SP exists and belongs to this kontraktor
        const action = await spRepository.findActionByIdAndKontraktor(input.id, input.namaKontraktor);
        if (!action) {
            throw new AppError("Surat Peringatan tidak ditemukan atau tidak untuk kontraktor ini.", 404);
        }

        if (action.status === 'ACKNOWLEDGED_BY_CONTRACTOR') {
            throw new AppError("Surat Peringatan ini sudah di-acknowledge sebelumnya.", 409);
        }

        if (!['SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR'].includes(action.status)) {
            throw new AppError("Status SP tidak valid untuk acknowledgement.", 409);
        }

        // Check if expired
        if (action.expires_at && new Date(action.expires_at) < new Date()) {
            throw new AppError("Surat Peringatan ini sudah expired (lewat 6 bulan).", 409);
        }

        const updated = await spRepository.acknowledgeAction({
            id: input.id,
            namaKontraktor: input.namaKontraktor,
            catatanAcknowledge: input.catatan,
            actor_email: actorEmail(input.actor),
            actor_role: actorRole(input.actor) || 'KONTRAKTOR',
        });

        if (!updated) {
            throw new AppError("Gagal acknowledge SP. Mungkin sudah diproses.", 409);
        }

        return updated;
    },

    // ===================================================================
    // ANALYTICS
    // ===================================================================

    async getAnalytics() {
        await spRepository.ensureSchema();
        
        const stats = await spRepository.getGlobalStats();
        const activeSp = await spRepository.getActiveSpWithExpiry();

        // Group by urgency
        const now = new Date();
        const expiringSoon = activeSp.filter(sp => {
            if (!sp.expires_at) return false;
            const daysLeft = Math.ceil((new Date(sp.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 30;
        });

        const critical = expiringSoon.filter(sp => {
            const daysLeft = Math.ceil((new Date(sp.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 7;
        });

        return {
            stats,
            expiring_soon: expiringSoon.length,
            critical_expiry: critical.length,
            expiring_sp_list: expiringSoon.slice(0, 10), // Top 10
        };
    },
};
