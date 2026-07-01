import { z } from "zod";

export const createSerahTerimaPdfSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    // Kompatibilitas client lama. Nilai ini sengaja diabaikan karena timestamp
    // resmi Serah Terima selalu ditentukan oleh server.
    tanggal_aktual: z.string().optional(),
});

export type CreateSerahTerimaPdfInput = z.infer<typeof createSerahTerimaPdfSchema>;

export const createUnifiedSerahTerimaPdfSchema = z.object({
    nomor_ulok: z.string().trim().min(1),
});

export type CreateUnifiedSerahTerimaPdfInput = z.infer<typeof createUnifiedSerahTerimaPdfSchema>;

export const listBerkasSerahTerimaQuerySchema = z.object({
    id_toko: z.coerce.number().int().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
});

export type ListBerkasSerahTerimaQueryInput = z.infer<typeof listBerkasSerahTerimaQuerySchema>;
