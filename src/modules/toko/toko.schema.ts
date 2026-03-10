import { z } from "zod";

export const createTokoSchema = z.object({
    nomor_ulok: z.string().min(1),
    nama_toko: z.string().min(1),
    kode_toko: z.string().min(1),
    cabang: z.string().min(1),
    alamat: z.string().min(1)
});

export type CreateTokoInput = z.infer<typeof createTokoSchema>;

export const loginUserCabangSchema = z.object({
    email_sat: z.string().trim().email(),
    cabang: z.string().trim().min(1)
});

export type LoginUserCabangInput = z.infer<typeof loginUserCabangSchema>;
