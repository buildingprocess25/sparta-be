import { z } from "zod";

export const createSerahTerimaPdfSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
});

export type CreateSerahTerimaPdfInput = z.infer<typeof createSerahTerimaPdfSchema>;

export const listBerkasSerahTerimaQuerySchema = z.object({
    id_toko: z.coerce.number().int().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
});

export type ListBerkasSerahTerimaQueryInput = z.infer<typeof listBerkasSerahTerimaQuerySchema>;
