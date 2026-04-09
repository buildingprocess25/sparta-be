import { z } from "zod";

export const detailItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    jenis_pekerjaan: z.string().min(1),
    satuan: z.string().min(1),
    volume: z.coerce.number().nonnegative(),
    harga_material: z.coerce.number().nonnegative(),
    harga_upah: z.coerce.number().nonnegative(),
    catatan: z.string().optional()
});

export const submitRabSchema = z.object({
    // --- field toko (masuk ke tabel toko, semua nullable kecuali nomor_ulok) ---
    nomor_ulok: z.string().min(1),
    lingkup_pekerjaan: z.string().optional(),
    nama_toko: z.string().optional(),
    proyek: z.string().optional(),
    cabang: z.string().optional(),
    alamat: z.string().optional(),
    nama_kontraktor: z.string().optional(),

    // --- field rab ---
    email_pembuat: z.string().email(),
    nama_pt: z.string().min(1),
    durasi_pekerjaan: z.string().min(1),
    logo: z.string().optional(),
    kategori_lokasi: z.string().optional(),
    no_polis: z.string().optional(),
    berlaku_polis: z.string().optional(),
    file_asuransi: z.string().optional(),
    luas_bangunan: z.string().optional(),
    luas_terbangun: z.string().optional(),
    luas_area_terbuka: z.string().optional(),
    luas_area_parkir: z.string().optional(),
    luas_area_sales: z.string().optional(),
    luas_gudang: z.string().optional(),

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