import { z } from "zod";

const sudutFotoItemsSchema = z.preprocess(
    (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return [];
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // fall back to comma-separated values
            }
            return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
        }
        return [];
    },
    z.array(
        z.union([
            z.string().trim().min(1),
            z.object({
                item_index: z.coerce.number().int().positive().optional(),
                sudut_foto: z.string().trim().min(1)
            })
        ])
    ).default([])
);

export const dokumentasiBangunanCreateSchema = z.object({
    nomor_ulok: z.string().trim().min(1),
    nama_toko: z.string().trim().min(1),
    kode_toko: z.string().trim().optional().default(""),
    cabang: z.string().trim().optional().default(""),
    tanggal_go: z.string().trim().optional().default(""),
    tanggal_serah_terima: z.string().trim().optional().default(""),
    tanggal_ambil_foto: z.string().trim().optional().default(""),
    spk_awal: z.string().trim().optional().default(""),
    spk_akhir: z.string().trim().optional().default(""),
    kontraktor_sipil: z.string().trim().optional().default(""),
    kontraktor_me: z.string().trim().optional().default(""),
    email_pengirim: z.string().trim().optional().default(""),
    status_validasi: z.string().trim().optional().default(""),
    alasan_revisi: z.string().trim().optional().default(""),
    pic_dokumentasi: z.string().trim().optional().default(""),
    sudut_foto_items: sudutFotoItemsSchema.optional()
});

export const dokumentasiBangunanUpdateSchema = z.object({
    nomor_ulok: z.string().trim().min(1).optional(),
    nama_toko: z.string().trim().min(1).optional(),
    kode_toko: z.string().trim().min(1).optional(),
    cabang: z.string().trim().optional(),
    tanggal_go: z.string().trim().optional(),
    tanggal_serah_terima: z.string().trim().optional(),
    tanggal_ambil_foto: z.string().trim().optional(),
    spk_awal: z.string().trim().optional(),
    spk_akhir: z.string().trim().optional(),
    kontraktor_sipil: z.string().trim().optional(),
    kontraktor_me: z.string().trim().optional(),
    email_pengirim: z.string().trim().optional(),
    status_validasi: z.string().trim().optional(),
    alasan_revisi: z.string().trim().optional(),
    pic_dokumentasi: z.string().trim().optional()
});

export const dokumentasiBangunanListQuerySchema = z.object({
    cabang: z.string().trim().optional(),
    kode_toko: z.string().trim().optional(),
    nomor_ulok: z.string().trim().optional()
});

export const dokumentasiBangunanIdParamSchema = z.object({
    id: z.coerce.number().int().positive()
});

export const dokumentasiBangunanItemIdParamSchema = z.object({
    itemId: z.coerce.number().int().positive()
});

export type DokumentasiBangunanCreateInput = z.infer<typeof dokumentasiBangunanCreateSchema>;
export type DokumentasiBangunanUpdateInput = z.infer<typeof dokumentasiBangunanUpdateSchema>;
export type DokumentasiBangunanListQueryInput = z.infer<typeof dokumentasiBangunanListQuerySchema>;
