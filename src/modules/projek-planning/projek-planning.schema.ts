import { z } from "zod";

// ============================================================
// SUBMIT FPD (oleh Coordinator/Cabang) — record baru
// ============================================================

export const submitProjekPlanningSchema = z.object({
    id_toko: z.coerce.number().int().min(0), // 0 means create new toko
    nomor_ulok: z.string().min(1),
    // New fields for manual toko creation
    cabang: z.string().optional().or(z.literal("")),
    nama_toko: z.string().optional().or(z.literal("")),
    kode_toko: z.string().optional().or(z.literal("")),
    alamat_toko: z.string().optional().or(z.literal("")),
    
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().optional().or(z.literal("")),
    jenis_proyek: z.string().optional().or(z.literal("")),
    estimasi_biaya: z.coerce.number().nonnegative().optional(),
    keterangan: z.string().optional(),
    link_fpd: z.string().optional().or(z.literal("")),

    // ── Identitas Pengajuan ──────────────────────────────────
    nama_pengaju: z.string().min(1, "Nama pengaju wajib diisi"),
    nama_lokasi: z.string().optional().or(z.literal("")),

    // ── Jenis Pengajuan Design ───────────────────────────────
    jenis_pengajuan: z.string().min(1, "Jenis pengajuan wajib dipilih"),
    jenis_pengajuan_lainnya: z.string().optional(),

    // ── Fasilitas Yang Disediakan ────────────────────────────
    fasilitas: z.array(z.object({
        jenis_fasilitas: z.string(),
        nama_fasilitas_lainnya: z.string().optional(),
        is_tersedia: z.coerce.boolean().default(false),
        keterangan: z.string().optional()
    })).optional().default([]),

    // ── Ketentuan dari Pengelola/Landlord/Pihak Ketiga ───────
    ketentuan: z.array(z.string()).optional().default([]),

    // ── Catatan Design (Hasil Ukur & Kondisi Lingkungan) ─────
    catatan_design: z.array(z.string()).optional().default([]),

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
    nama_lokasi: z.string().optional().or(z.literal("")),

    // ── Jenis Pengajuan Design ───────────────────────────────
    jenis_pengajuan: z.string().min(1, "Jenis pengajuan wajib dipilih"),
    jenis_pengajuan_lainnya: z.string().optional(),

    // ── Fasilitas Yang Disediakan ────────────────────────────
    fasilitas: z.array(z.object({
        jenis_fasilitas: z.string(),
        nama_fasilitas_lainnya: z.string().optional(),
        is_tersedia: z.coerce.boolean().default(false),
        keterangan: z.string().optional()
    })).optional().default([]),

    // ── Ketentuan dari Pengelola/Landlord/Pihak Ketiga ───────
    ketentuan: z.array(z.string()).optional().default([]),

    // ── Catatan Design (Hasil Ukur & Kondisi Lingkungan) ─────
    catatan_design: z.array(z.string()).optional().default([]),

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
