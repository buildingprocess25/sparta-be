import { z } from "zod";

export const opnameStatusSchema = z.enum(["pending", "disetujui", "ditolak"]);

export const createOpnameSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    id_opname_final: z.coerce.number().int().positive(),
    id_rab_item: z.coerce.number().int().positive(),
    status: opnameStatusSchema.optional(),
    volume_akhir: z.coerce.number().int(),
    selisih_volume: z.coerce.number().int(),
    total_selisih: z.coerce.number().int(),
    desain: z.string().trim().min(1).optional(),
    kualitas: z.string().trim().min(1).optional(),
    spesifikasi: z.string().trim().min(1).optional(),
    catatan: z.string().trim().min(1).optional()
});

export const bulkCreateOpnameItemSchema = z.object({
    id_rab_item: z.coerce.number().int().positive(),
    status: opnameStatusSchema.optional(),
    volume_akhir: z.coerce.number().int(),
    selisih_volume: z.coerce.number().int(),
    total_selisih: z.coerce.number().int(),
    desain: z.string().trim().min(1).optional(),
    kualitas: z.string().trim().min(1).optional(),
    spesifikasi: z.string().trim().min(1).optional(),
    catatan: z.string().trim().min(1).optional()
});

export const bulkCreateOpnameSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    email_pembuat: z.string().email(),
    items: z.array(bulkCreateOpnameItemSchema).min(1)
});

export const updateOpnameSchema = z.object({
    id_toko: z.coerce.number().int().positive().optional(),
    id_opname_final: z.coerce.number().int().positive().optional(),
    id_rab_item: z.coerce.number().int().positive().optional(),
    status: opnameStatusSchema.optional(),
    volume_akhir: z.coerce.number().int().optional(),
    selisih_volume: z.coerce.number().int().optional(),
    total_selisih: z.coerce.number().int().optional(),
    desain: z.string().trim().min(1).optional(),
    kualitas: z.string().trim().min(1).optional(),
    spesifikasi: z.string().trim().min(1).optional(),
    foto: z.string().trim().min(1).optional(),
    catatan: z.string().trim().min(1).optional()
}).refine(
    (data: {
        id_toko?: number;
        id_opname_final?: number;
        id_rab_item?: number;
        status?: "pending" | "disetujui" | "ditolak";
        volume_akhir?: number;
        selisih_volume?: number;
        total_selisih?: number;
        desain?: string;
        kualitas?: string;
        spesifikasi?: string;
        foto?: string;
        catatan?: string;
    }) =>
        typeof data.id_toko !== "undefined"
        || typeof data.id_opname_final !== "undefined"
        || typeof data.id_rab_item !== "undefined"
        || typeof data.status !== "undefined"
        || typeof data.volume_akhir !== "undefined"
        || typeof data.selisih_volume !== "undefined"
        || typeof data.total_selisih !== "undefined"
        || typeof data.desain !== "undefined"
        || typeof data.kualitas !== "undefined"
        || typeof data.spesifikasi !== "undefined"
        || typeof data.foto !== "undefined"
        || typeof data.catatan !== "undefined",
    { message: "Minimal satu field harus diisi untuk update" }
);

export const listOpnameQuerySchema = z.object({
    id_toko: z.coerce.number().int().positive().optional(),
    id_opname_final: z.coerce.number().int().positive().optional(),
    id_rab_item: z.coerce.number().int().positive().optional(),
    status: opnameStatusSchema.optional()
});

export type CreateOpnameInput = z.infer<typeof createOpnameSchema>;
export type CreateOpnameData = CreateOpnameInput & { foto?: string };
export type CreateBulkOpnameItemInput = z.infer<typeof bulkCreateOpnameItemSchema>;
export type CreateBulkOpnameItemData = CreateBulkOpnameItemInput & { foto?: string };
export type BulkCreateOpnameInput = z.infer<typeof bulkCreateOpnameSchema>;
export type UpdateOpnameInput = z.infer<typeof updateOpnameSchema>;
export type ListOpnameQueryInput = z.infer<typeof listOpnameQuerySchema>;
