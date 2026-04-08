import { z } from "zod";

export const detailItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1).max(255),
    jenis_pekerjaan: z.string().min(1).max(255),
    satuan: z.string().min(1).max(50),
    volume: z.coerce.number().nonnegative(),
    harga_material: z.coerce.number().nonnegative(),
    harga_upah: z.coerce.number().nonnegative(),
    catatan: z.string().max(255).optional()
});

export const submitRabSchema = z.object({
    // --- field toko (masuk ke tabel toko, semua nullable kecuali nomor_ulok) ---
    nomor_ulok: z.string().min(1).max(255),
    lingkup_pekerjaan: z.string().max(255).optional(),
    nama_toko: z.string().max(255).optional(),
    proyek: z.string().max(255).optional(),
    cabang: z.string().max(255).optional(),
    alamat: z.string().max(255).optional(),
    nama_kontraktor: z.string().max(255).optional(),

    // --- field rab ---
    email_pembuat: z.string().email(),
    nama_pt: z.string().min(1).max(255),
    durasi_pekerjaan: z.string().min(1).max(255),
    logo: z.string().max(255).optional(),
    kategori_lokasi: z.string().max(255).optional(),
    no_polis: z.string().max(255).optional(),
    berlaku_polis: z.string().max(255).optional(),
    file_asuransi: z.string().max(500).optional(),
    luas_bangunan: z.string().max(255).optional(),
    luas_terbangun: z.string().max(255).optional(),
    luas_area_terbuka: z.string().max(255).optional(),
    luas_area_parkir: z.string().max(255).optional(),
    luas_area_sales: z.string().max(255).optional(),
    luas_gudang: z.string().max(255).optional(),

    // --- field rab_item ---
    detail_items: z.array(detailItemSchema).min(1)
});

export const rabListQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional(),
    cabang: z.string().optional()
});

export type SubmitRabInput = z.infer<typeof submitRabSchema>;
export type DetailItemInput = z.infer<typeof detailItemSchema>;
export type RabListQuery = z.infer<typeof rabListQuerySchema>;
