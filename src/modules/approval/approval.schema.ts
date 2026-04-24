import { z } from "zod";

const jabatanSchema = z.enum(["KOORDINATOR", "MANAGER", "DIREKTUR", "KONTRAKTOR"]);
const tindakanSchema = z.enum(["APPROVE", "REJECT"]);

export const approvalActionSchema = z
    .object({
        approver_email: z.string().email(),
        jabatan: jabatanSchema,
        tindakan: tindakanSchema,
        // Frontend/Postman kadang mengirim null saat approve.
        alasan_penolakan: z.string().nullable().optional()
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
