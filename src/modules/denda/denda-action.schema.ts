import { z } from "zod";

export const dendaActionTypeSchema = z.enum(["SP", "TAKEOVER"]);

export const listDendaActionsQuerySchema = z.object({
    id_toko: z.coerce.number().positive().optional(),
    id_opname_final: z.coerce.number().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
});

export const createDendaActionSchema = z.object({
    id_opname_final: z.coerce.number().positive(),
    action_type: dendaActionTypeSchema,
    catatan: z.string().trim().max(2000).optional().nullable(),
});

export type DendaActionType = z.infer<typeof dendaActionTypeSchema>;
export type ListDendaActionsQuery = z.infer<typeof listDendaActionsQuerySchema>;
export type CreateDendaActionInput = z.infer<typeof createDendaActionSchema>;
