import { z } from "zod";

export const detailItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    jenis_pekerjaan: z.string().min(1),
    satuan: z.string().min(1),
    volume: z.coerce.number().nonnegative(),
    harga_material: z.coerce.number().nonnegative(),
    harga_upah: z.coerce.number().nonnegative()
});

export const submitRabSchema = z.object({
    nomor_ulok: z.string().min(1),
    email_pembuat: z.string().email(),
    nama_pt: z.string().min(1),
    lingkup_pekerjaan: z.string().min(1),
    durasi_pekerjaan: z.string().min(1),
    logo: z.string().optional(),
    kategori_lokasi: z.string().optional(),
    luas_bangunan: z.string().optional(),
    luas_terbangun: z.string().optional(),
    luas_area_terbuka: z.string().optional(),
    luas_area_parkir: z.string().optional(),
    luas_area_sales: z.string().optional(),
    luas_gudang: z.string().optional(),
    detail_items: z.array(detailItemSchema).min(1)
});

export const rabListQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional()
});

export type SubmitRabInput = z.infer<typeof submitRabSchema>;
export type DetailItemInput = z.infer<typeof detailItemSchema>;
export type RabListQuery = z.infer<typeof rabListQuerySchema>;
