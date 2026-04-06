import { z } from "zod";

export const createPertambahanSpkSchema = z.object({
    id_spk: z.coerce.number().int().positive(),
    pertambahan_hari: z.string().min(1),
    tanggal_spk_akhir: z.string().min(1),
    tanggal_spk_akhir_setelah_perpanjangan: z.string().min(1),
    alasan_perpanjangan: z.string().min(1),
    dibuat_oleh: z.string().min(1),
    status_persetujuan: z.string().min(1).default("Menunggu Persetujuan"),
    disetujui_oleh: z.string().optional(),
    waktu_persetujuan: z.string().optional(),
    alasan_penolakan: z.string().optional(),
    link_pdf: z.string().optional(),
    link_lampiran_pendukung: z.string().optional()
});

export const updatePertambahanSpkSchema = z.object({
    id_spk: z.coerce.number().int().positive().optional(),
    pertambahan_hari: z.string().min(1).optional(),
    tanggal_spk_akhir: z.string().min(1).optional(),
    tanggal_spk_akhir_setelah_perpanjangan: z.string().min(1).optional(),
    alasan_perpanjangan: z.string().min(1).optional(),
    dibuat_oleh: z.string().min(1).optional(),
    status_persetujuan: z.string().min(1).optional(),
    disetujui_oleh: z.string().optional(),
    waktu_persetujuan: z.string().optional(),
    alasan_penolakan: z.string().optional(),
    link_pdf: z.string().optional(),
    link_lampiran_pendukung: z.string().optional()
})
    .refine((value) => Object.keys(value).length > 0, {
        message: "Minimal satu field harus diisi untuk update"
    });

export const pertambahanSpkListQuerySchema = z.object({
    id_spk: z.coerce.number().int().positive().optional(),
    status_persetujuan: z.string().optional()
});

export const pertambahanSpkApprovalSchema = z
    .object({
        approver_email: z.string().email(),
        tindakan: z.enum(["APPROVE", "REJECT"]),
        alasan_penolakan: z.string().optional()
    })
    .superRefine((value, ctx) => {
        if (value.tindakan === "REJECT" && !value.alasan_penolakan?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "alasan_penolakan wajib diisi saat reject",
                path: ["alasan_penolakan"]
            });
        }
    });

export type CreatePertambahanSpkInput = z.infer<typeof createPertambahanSpkSchema>;
export type UpdatePertambahanSpkInput = z.infer<typeof updatePertambahanSpkSchema>;
export type PertambahanSpkListQuery = z.infer<typeof pertambahanSpkListQuerySchema>;
export type PertambahanSpkApprovalInput = z.infer<typeof pertambahanSpkApprovalSchema>;
