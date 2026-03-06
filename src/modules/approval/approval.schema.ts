import { z } from "zod";

const jabatanSchema = z.enum(["KOORDINATOR", "MANAGER", "DIREKTUR"]);
const tindakanSchema = z.enum(["APPROVE", "REJECT"]);

export const approvalActionSchema = z
    .object({
        approver_email: z.string().email(),
        jabatan: jabatanSchema,
        tindakan: tindakanSchema,
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

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
