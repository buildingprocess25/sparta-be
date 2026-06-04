import { z } from "zod";

const jabatanSchema = z.preprocess((value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "DIREKTUR KONTRAKTOR" || normalized === "DIREKTUR_KONTRAKTOR") {
        return "DIREKTUR";
    }
    return normalized;
}, z.enum(["KOORDINATOR", "MANAGER", "DIREKTUR", "KONTRAKTOR"]));
const tindakanSchema = z.enum(["APPROVE", "REJECT"]);

export const approvalActionSchema = z
    .object({
        approver_email: z.string().email(),
        nama_lengkap: z.string().nullable().optional(),
        jabatan: jabatanSchema,
        tindakan: tindakanSchema,
        // Frontend/Postman kadang mengirim null saat approve.
        alasan_penolakan: z.string().nullable().optional(),
        catatan_approval: z.string().nullable().optional(),
        catatan_revisi_umum: z.string().nullable().optional(),
        revisi_item_ids: z.array(z.coerce.number().int().positive()).optional(),
        revisi_item_notes: z.record(z.string(), z.string().nullable().optional()).optional()
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

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
