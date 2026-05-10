import { z } from "zod";

// ============================================================
// SUBMIT FPD (oleh Coordinator/Cabang) — record baru
// ============================================================

export const submitProjekPlanningSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    nomor_ulok: z.string().min(1),
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().optional().or(z.literal("")),
    jenis_proyek: z.string().optional().or(z.literal("")),
    estimasi_biaya: z.coerce.number().nonnegative().optional(),
    keterangan: z.string().optional(),
    link_fpd: z.string().optional().or(z.literal("")),

    // ── Identitas Pengajuan ──────────────────────────────────
    nama_pengaju: z.string().min(1, "Nama pengaju wajib diisi"),
    nama_lokasi: z.string().min(1, "Nama lokasi wajib diisi"),

    // ── Jenis Pengajuan Design ───────────────────────────────
    jenis_pengajuan: z.string().min(1, "Jenis pengajuan wajib dipilih"),
    jenis_pengajuan_lainnya: z.string().optional(),

    // ── Fasilitas Yang Disediakan ────────────────────────────
    fasilitas_air_bersih: z.coerce.boolean().optional().default(false),
    fasilitas_air_bersih_keterangan: z.string().optional(),
    fasilitas_drain: z.coerce.boolean().optional().default(false),
    fasilitas_drain_keterangan: z.string().optional(),
    fasilitas_ac: z.coerce.boolean().optional().default(false),
    fasilitas_ac_keterangan: z.string().optional(),
    fasilitas_lainnya: z.string().optional(),
    fasilitas_lainnya_keterangan: z.string().optional(),

    // ── Ketentuan dari Pengelola/Landlord/Pihak Ketiga ───────
    ketentuan_1: z.string().optional(),
    ketentuan_2: z.string().optional(),
    ketentuan_3: z.string().optional(),
    ketentuan_4: z.string().optional(),
    ketentuan_5: z.string().optional(),

    // ── Catatan Design (Hasil Ukur & Kondisi Lingkungan) ─────
    catatan_design_1: z.string().optional(),
    catatan_design_2: z.string().optional(),
    catatan_design_3: z.string().optional(),
    catatan_design_4: z.string().optional(),
    catatan_design_5: z.string().optional(),

    // ── Upload Files ─────────────────────────────────────────
    link_gambar_rab_sipil: z.string().optional(),
    link_gambar_rab_me: z.string().optional(),
});

export type SubmitProjekPlanningInput = z.infer<typeof submitProjekPlanningSchema>;

// ============================================================
// RESUBMIT FPD (oleh Coordinator/Cabang — update record DRAFT yang sudah ada)
// ============================================================

export const resubmitProjekPlanningSchema = z.object({
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().optional().or(z.literal("")),
    jenis_proyek: z.string().optional().or(z.literal("")),
    estimasi_biaya: z.coerce.number().nonnegative().optional(),
    keterangan: z.string().optional(),
    link_fpd: z.string().optional().or(z.literal("")),

    // ── Identitas Pengajuan ──────────────────────────────────
    nama_pengaju: z.string().min(1, "Nama pengaju wajib diisi"),
    nama_lokasi: z.string().min(1, "Nama lokasi wajib diisi"),

    // ── Jenis Pengajuan Design ───────────────────────────────
    jenis_pengajuan: z.string().min(1, "Jenis pengajuan wajib dipilih"),
    jenis_pengajuan_lainnya: z.string().optional(),

    // ── Fasilitas Yang Disediakan ────────────────────────────
    fasilitas_air_bersih: z.coerce.boolean().optional().default(false),
    fasilitas_air_bersih_keterangan: z.string().optional(),
    fasilitas_drain: z.coerce.boolean().optional().default(false),
    fasilitas_drain_keterangan: z.string().optional(),
    fasilitas_ac: z.coerce.boolean().optional().default(false),
    fasilitas_ac_keterangan: z.string().optional(),
    fasilitas_lainnya: z.string().optional(),
    fasilitas_lainnya_keterangan: z.string().optional(),

    // ── Ketentuan dari Pengelola/Landlord/Pihak Ketiga ───────
    ketentuan_1: z.string().optional(),
    ketentuan_2: z.string().optional(),
    ketentuan_3: z.string().optional(),
    ketentuan_4: z.string().optional(),
    ketentuan_5: z.string().optional(),

    // ── Catatan Design (Hasil Ukur & Kondisi Lingkungan) ─────
    catatan_design_1: z.string().optional(),
    catatan_design_2: z.string().optional(),
    catatan_design_3: z.string().optional(),
    catatan_design_4: z.string().optional(),
    catatan_design_5: z.string().optional(),

    // ── Upload Files ─────────────────────────────────────────
    link_gambar_rab_sipil: z.string().optional(),
    link_gambar_rab_me: z.string().optional(),
});

export type ResubmitProjekPlanningInput = z.infer<typeof resubmitProjekPlanningSchema>;

// ============================================================
// APPROVAL (dipakai oleh BM, PP Manager)
// ============================================================

export const approvalSchema = z
    .object({
        approver_email: z.string().trim().email(),
        tindakan: z.enum(["APPROVE", "REJECT"]),
        alasan_penolakan: z.string().optional(),
    })
    .superRefine((val, ctx) => {
        if (val.tindakan === "REJECT" && !val.alasan_penolakan?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "alasan_penolakan wajib diisi saat menolak",
                path: ["alasan_penolakan"],
            });
        }
    });

export type ApprovalInput = z.infer<typeof approvalSchema>;

// ============================================================
// PP APPROVAL STAGE 1 (bisa APPROVE dengan/tanpa 3D, atau REJECT)
// ============================================================

export const ppApproval1Schema = z
    .object({
        approver_email: z.string().trim().email(),
        tindakan: z.enum(["APPROVE", "REJECT"]),
        butuh_desain_3d: z.boolean().optional().default(false),
        alasan_penolakan: z.string().optional(),
    })
    .superRefine((val, ctx) => {
        if (val.tindakan === "REJECT" && !val.alasan_penolakan?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "alasan_penolakan wajib diisi saat menolak",
                path: ["alasan_penolakan"],
            });
        }
    });

export type PpApproval1Input = z.infer<typeof ppApproval1Schema>;

// ============================================================
// UPLOAD 3D (oleh PP Specialist)
// ============================================================

export const upload3dSchema = z.object({
    uploader_email: z.string().email(),
    link_desain_3d: z.string().optional(),
    keterangan: z.string().optional(),
});

export type Upload3dInput = z.infer<typeof upload3dSchema>;

// ============================================================
// UPLOAD RAB & GAMBAR KERJA (oleh Coordinator/Cabang)
// ============================================================

export const uploadRabSchema = z.object({
    uploader_email: z.string().email(),
    link_rab: z.string().optional(),
    link_gambar_kerja: z.string().optional(),
    keterangan: z.string().optional(),
});

export type UploadRabInput = z.infer<typeof uploadRabSchema>;

// ============================================================
// QUERY LIST
// ============================================================

export const listProjekPlanningQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional(),
    cabang: z.string().optional(),
    email_pembuat: z.string().optional(),
    id_toko: z.coerce.number().int().positive().optional(),
});

export type ListProjekPlanningQuery = z.infer<typeof listProjekPlanningQuerySchema>;
