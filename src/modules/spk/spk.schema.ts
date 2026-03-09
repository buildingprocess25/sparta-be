import { z } from "zod";

export const submitSpkSchema = z.object({
    nomor_ulok: z.string().min(1),
    email_pembuat: z.string().email(),
    lingkup_pekerjaan: z.string().min(1),
    nama_kontraktor: z.string().min(1),
    proyek: z.string().min(1),
    waktu_mulai: z.string().min(1),
    durasi: z.coerce.number().int().positive(),
    grand_total: z.coerce.number().nonnegative(),
    par: z.string().optional().default(""),
    spk_manual_1: z.string().optional().default(""),
    spk_manual_2: z.string().optional().default("")
});

export const spkApprovalSchema = z
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

export const spkListQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional()
});

export type SubmitSpkInput = z.infer<typeof submitSpkSchema>;
export type SpkApprovalInput = z.infer<typeof spkApprovalSchema>;
export type SpkListQuery = z.infer<typeof spkListQuerySchema>;
