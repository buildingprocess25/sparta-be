import { z } from "zod";

export const dendaActionTypeSchema = z.enum(["SP", "TAKEOVER"]);
export const dendaActionStatusSchema = z.enum([
    "WAITING_MANAGER",
    "REJECTED_BY_MANAGER",
    "APPROVED",
    "SENT_TO_CONTRACTOR",
    "VIEWED_BY_CONTRACTOR",
    "ACKNOWLEDGED_BY_CONTRACTOR",
]);

export const listDendaActionsQuerySchema = z.object({
    id_toko: z.coerce.number().positive().optional(),
    id_opname_final: z.coerce.number().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
});

const requiredText = (max = 2000) => z.string().trim().min(1).max(max);

export const createDendaActionSchema = z.discriminatedUnion("action_type", [
    z.object({
        id_opname_final: z.coerce.number().positive(),
        action_type: z.literal("SP"),
        sp_level: z.coerce.number().int().min(1).max(3),
        catatan: requiredText(),
        instruksi_tindak_lanjut: requiredText(),
        deadline_tindak_lanjut: requiredText(64),
        lampiran_1_url: requiredText(1000),
        lampiran_2_url: requiredText(1000),
    }),
    z.object({
        id_opname_final: z.coerce.number().positive(),
        action_type: z.literal("TAKEOVER"),
        catatan: requiredText(),
        lampiran_1_url: z.string().trim().max(1000).optional().nullable(),
        lampiran_2_url: z.string().trim().max(1000).optional().nullable(),
    }),
]);

export const dendaActionIdParamsSchema = z.object({
    id: z.coerce.number().positive(),
});

export const rejectDendaActionSchema = z.object({
    alasan_penolakan: requiredText(),
});

export type DendaActionType = z.infer<typeof dendaActionTypeSchema>;
export type DendaActionStatus = z.infer<typeof dendaActionStatusSchema>;
export type ListDendaActionsQuery = z.infer<typeof listDendaActionsQuerySchema>;
export type CreateDendaActionInput = z.infer<typeof createDendaActionSchema>;
export type RejectDendaActionInput = z.infer<typeof rejectDendaActionSchema>;
