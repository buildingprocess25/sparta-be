import { z } from "zod";

export const createSerahTerimaPdfSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
});

export type CreateSerahTerimaPdfInput = z.infer<typeof createSerahTerimaPdfSchema>;
