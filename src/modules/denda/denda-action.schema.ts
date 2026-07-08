import { z } from "zod";

export const dendaActionTypeSchema = z.enum(["SP", "TAKEOVER"]);
export const spReasonSchema = z.enum(["KETERLAMBATAN", "MENOLAK_SPK", "MANIPULASI"]);
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
    action_type: z.enum(["SP", "TAKEOVER"]).optional(),
    cabang_array: z.array(z.string()).optional(),
});

const requiredText = (max = 2000) => z.string().trim().min(1).max(max);

export const createDendaActionSchema = z.discriminatedUnion("action_type", [
    z.object({
        action_type: z.literal("SP"),
        id_toko: z.coerce.number().positive().optional().nullable(),
        nama_kontraktor: z.string().trim().min(1).optional(),
        id_opname_final: z.coerce.number().positive().optional().nullable(),
        sp_level: z.coerce.number().int().min(1).max(3),
        alasan_sp: spReasonSchema,
        catatan: requiredText(),
        lampiran_1_url: z.string().trim().max(1000).optional().nullable(),
        lampiran_2_url: z.string().trim().max(1000).optional().nullable(),
    }),
    z.object({
        id_opname_final: z.coerce.number().positive(),
        action_type: z.literal("TAKEOVER"),
        catatan: requiredText(),
        lampiran_1_url: z.string().trim().max(1000).optional().nullable(),
        lampiran_2_url: z.string().trim().max(1000).optional().nullable(),
    })
]).refine(data => {
    if (data.action_type === 'SP') {
        if (data.alasan_sp !== 'MANIPULASI' && !data.id_toko) {
            return false;
        }
        if (data.alasan_sp === 'MANIPULASI' && !data.nama_kontraktor && !data.id_toko) {
            return false;
        }
    }
    return true;
}, {
    message: "ULOK wajib dipilih kecuali untuk alasan Manipulasi (di mana nama_kontraktor harus ada).",
    path: ["id_toko"]
});

export const dendaActionIdParamsSchema = z.object({
    id: z.coerce.number().positive(),
});

export const rejectDendaActionSchema = z.object({
    alasan_penolakan: requiredText(),
});

export type DendaActionType = z.infer<typeof dendaActionTypeSchema>;
export type DendaActionStatus = z.infer<typeof dendaActionStatusSchema>;
export type SpReason = z.infer<typeof spReasonSchema>;
export type ListDendaActionsQuery = z.infer<typeof listDendaActionsQuerySchema>;
export type CreateDendaActionInput = z.infer<typeof createDendaActionSchema>;
export type RejectDendaActionInput = z.infer<typeof rejectDendaActionSchema>;
