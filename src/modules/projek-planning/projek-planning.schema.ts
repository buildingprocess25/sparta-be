import { z } from "zod";

// ============================================================
// SUBMIT FPD (oleh Coordinator/Cabang) — record baru
// ============================================================

export const submitProjekPlanningSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    nomor_ulok: z.string().min(1),
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().min(1),
    jenis_proyek: z.string().min(1),
    estimasi_biaya: z.coerce.number().nonnegative().optional(),
    keterangan: z.string().optional(),
    link_fpd: z.string().url().optional().or(z.literal("")),
});

export type SubmitProjekPlanningInput = z.infer<typeof submitProjekPlanningSchema>;

// ============================================================
// RESUBMIT FPD (oleh Coordinator/Cabang — update record DRAFT yang sudah ada)
// ============================================================

export const resubmitProjekPlanningSchema = z.object({
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().min(1),
    jenis_proyek: z.string().min(1),
    estimasi_biaya: z.coerce.number().nonnegative().optional(),
    keterangan: z.string().optional(),
    link_fpd: z.string().url().optional().or(z.literal("")),
});

export type ResubmitProjekPlanningInput = z.infer<typeof resubmitProjekPlanningSchema>;

// ============================================================
// APPROVAL (dipakai oleh BM, PP Manager)
// ============================================================

export const approvalSchema = z
    .object({
        approver_email: z.string().email(),
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
        approver_email: z.string().email(),
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
    link_desain_3d: z.string().min(1, "Link desain 3D wajib diisi"),
    keterangan: z.string().optional(),
});

export type Upload3dInput = z.infer<typeof upload3dSchema>;

// ============================================================
// UPLOAD RAB & GAMBAR KERJA (oleh Coordinator/Cabang)
// ============================================================

export const uploadRabSchema = z
    .object({
        uploader_email: z.string().email(),
        link_rab: z.string().optional(),
        link_gambar_kerja: z.string().optional(),
        keterangan: z.string().optional(),
    })
    .superRefine((val, ctx) => {
        if (!val.link_rab?.trim() && !val.link_gambar_kerja?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Minimal link_rab atau link_gambar_kerja harus diisi",
                path: ["link_rab"],
            });
        }
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
