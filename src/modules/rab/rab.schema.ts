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
    rev_logo: z.string().optional(),
    is_revisi: z
        .union([
            z.boolean(),
            z.enum(["true", "false"]).transform((value) => value === "true")
        ])
        .optional(),
    id_rab_revisi: z.coerce.number().int().positive().optional(),
    kategori_lokasi: z.string().optional(),
    no_polis: z.string().optional(),
    berlaku_polis: z.string().optional(),
    file_asuransi: z.string().optional(),
    rev_file_asuransi: z.string().optional(),
    luas_bangunan: z.string().optional(),
    luas_terbangun: z.string().optional(),
    luas_area_terbuka: z.string().optional(),
    luas_area_parkir: z.string().optional(),
    luas_area_sales: z.string().optional(),
    luas_gudang: z.string().optional(),
    alamat_cabang: z.string().nullable().optional(),

    // --- field rab_item ---
    detail_items: z.array(detailItemSchema).min(1)
});

export const rabListQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional(),
    cabang: z.string().optional(),
    nama_pt: z.string().optional(),
    email_pembuat: z.string().optional(),
    id_toko: z.coerce.number().int().positive().optional()
});

export const updateRabStatusSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    id_rab: z.coerce.number().int().positive(),
    status: z.string().min(1)
});

export const updateRabItemSchema = detailItemSchema.extend({
    id: z.coerce.number().int().positive()
});

export const bulkUpdateRabItemsSchema = z.object({
    items: z.array(updateRabItemSchema).min(1)
});

export const deleteRabItemsSchema = z.object({
    item_ids: z.array(z.coerce.number().int().positive()).min(1)
});

export type SubmitRabInput = z.infer<typeof submitRabSchema>;
export type DetailItemInput = z.infer<typeof detailItemSchema>;
export type RabListQuery = z.infer<typeof rabListQuerySchema>;
export type UpdateRabStatusInput = z.infer<typeof updateRabStatusSchema>;
export type UpdateRabItemInput = z.infer<typeof updateRabItemSchema>;
export type BulkUpdateRabItemsInput = z.infer<typeof bulkUpdateRabItemsSchema>;
export type DeleteRabItemsInput = z.infer<typeof deleteRabItemsSchema>;