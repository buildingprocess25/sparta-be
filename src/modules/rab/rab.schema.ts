import { z } from "zod";

const VARCHAR_255 = 255;
const VARCHAR_50 = 50;
const VARCHAR_500 = 500;

export const detailItemSchema = z.object({
    kategori_pekerjaan: z.string().trim().min(1).max(VARCHAR_255),
    jenis_pekerjaan: z.string().trim().min(1).max(VARCHAR_255),
    satuan: z.string().trim().min(1).max(VARCHAR_50),
    volume: z.coerce.number().nonnegative(),
    harga_material: z.coerce.number().nonnegative(),
    harga_upah: z.coerce.number().nonnegative(),
    catatan: z.string().trim().max(VARCHAR_255).optional()
});

export const submitRabSchema = z.object({
    // --- field toko (masuk ke tabel toko, semua nullable kecuali nomor_ulok) ---
    nomor_ulok: z.string().trim().min(1).max(VARCHAR_255),
    lingkup_pekerjaan: z.string().trim().max(VARCHAR_255).optional(),
    nama_toko: z.string().trim().max(VARCHAR_255).optional(),
    proyek: z.string().trim().max(VARCHAR_255).optional(),
    cabang: z.string().trim().max(VARCHAR_255).optional(),
    alamat: z.string().trim().max(VARCHAR_255).optional(),
    nama_kontraktor: z.string().trim().max(VARCHAR_255).optional(),

    // --- field rab ---
    email_pembuat: z.string().email(),
    nama_pt: z.string().trim().min(1).max(VARCHAR_255),
    durasi_pekerjaan: z.string().trim().min(1).max(VARCHAR_255),
    logo: z.string().trim().max(VARCHAR_255).optional(),
    kategori_lokasi: z.string().trim().max(VARCHAR_255).optional(),
    no_polis: z.string().trim().max(VARCHAR_255).optional(),
    berlaku_polis: z.string().trim().max(VARCHAR_255).optional(),
    file_asuransi: z.string().trim().max(VARCHAR_500).optional(),
    luas_bangunan: z.string().trim().max(VARCHAR_255).optional(),
    luas_terbangun: z.string().trim().max(VARCHAR_255).optional(),
    luas_area_terbuka: z.string().trim().max(VARCHAR_255).optional(),
    luas_area_parkir: z.string().trim().max(VARCHAR_255).optional(),
    luas_area_sales: z.string().trim().max(VARCHAR_255).optional(),
    luas_gudang: z.string().trim().max(VARCHAR_255).optional(),

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