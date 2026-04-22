import { z } from "zod";

export const opnameFinalListQuerySchema = z.object({
    status: z.string().trim().min(1).optional(),
    id_toko: z.coerce.number().int().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
    cabang: z.string().trim().min(1).optional()
});

export const lockOpnameFinalItemSchema = z.object({
    id_rab_item: z.coerce.number().int().positive(),
    status: z.enum(["pending", "disetujui", "ditolak"]).optional(),
    volume_akhir: z.coerce.number().int(),
    selisih_volume: z.coerce.number().int(),
    total_selisih: z.coerce.number().int(),
    total_harga_opname: z.coerce.number().int().optional().default(0),
    desain: z.string().trim().min(1).optional(),
    kualitas: z.string().trim().min(1).optional(),
    spesifikasi: z.string().trim().min(1).optional(),
    foto: z.string().trim().min(1).optional(),
    catatan: z.string().trim().min(1).optional()
});

export const lockOpnameFinalSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    email_pembuat: z.string().email(),
    grand_total_opname: z.union([z.string().trim().min(1), z.coerce.number()]).transform((value) => String(value)),
    grand_total_rab: z.union([z.string().trim().min(1), z.coerce.number()]).transform((value) => String(value)),
    opname_item: z.array(lockOpnameFinalItemSchema).min(1)
});

export type OpnameFinalListQueryInput = z.infer<typeof opnameFinalListQuerySchema>;
export type LockOpnameFinalInput = z.infer<typeof lockOpnameFinalSchema>;
export type LockOpnameFinalItemInput = z.infer<typeof lockOpnameFinalItemSchema>;
