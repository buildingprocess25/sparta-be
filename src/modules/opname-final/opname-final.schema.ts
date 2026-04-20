import { z } from "zod";

export const opnameFinalListQuerySchema = z.object({
    status: z.string().trim().min(1).optional(),
    id_toko: z.coerce.number().int().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
    cabang: z.string().trim().min(1).optional()
});

export type OpnameFinalListQueryInput = z.infer<typeof opnameFinalListQuerySchema>;
