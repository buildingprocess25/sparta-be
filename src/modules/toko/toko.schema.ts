import { z } from "zod";

export const createTokoSchema = z.object({
    nomor_ulok: z.string().min(1),
    nama_toko: z.string().min(1),
    kode_toko: z.string().min(1),
    cabang: z.string().min(1),
    alamat: z.string().min(1)
});

export type CreateTokoInput = z.infer<typeof createTokoSchema>;

export const listTokoQuerySchema = z.object({
    search: z.string().trim().min(1).optional(),
    cabang: z.string().trim().min(1).optional()
});

export type ListTokoQueryInput = z.infer<typeof listTokoQuerySchema>;

export const loginUserCabangSchema = z.object({
    email_sat: z.string().trim().email(),
    cabang: z.string().trim().min(1)
});

export type LoginUserCabangInput = z.infer<typeof loginUserCabangSchema>;
