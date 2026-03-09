import { z } from "zod";

// --- Login ---
export const loginDocSchema = z.object({
    username: z.string(),
    password: z.string(),
});
export type LoginDocInput = z.infer<typeof loginDocSchema>;

// --- File item di dalam save / update ---
const fileItemSchema = z.object({
    category: z.string().optional(),
    filename: z.string().optional(),
    type: z.string().optional(),
    data: z.string().optional(),
    deleted: z.boolean().optional(),
});

// --- Save ---
export const saveDocumentSchema = z.object({
    kode_toko: z.string().min(1),
    nama_toko: z.string().min(1),
    cabang: z.string().min(1),
    luas_sales: z.union([z.string(), z.number()]).optional().default(""),
    luas_parkir: z.union([z.string(), z.number()]).optional().default(""),
    luas_gudang: z.union([z.string(), z.number()]).optional().default(""),
    luas_bangunan_lantai_1: z.union([z.string(), z.number()]).optional().default(""),
    luas_bangunan_lantai_2: z.union([z.string(), z.number()]).optional().default(""),
    luas_bangunan_lantai_3: z.union([z.string(), z.number()]).optional().default(""),
    total_luas_bangunan: z.union([z.string(), z.number()]).optional().default(""),
    luas_area_terbuka: z.union([z.string(), z.number()]).optional().default(""),
    tinggi_plafon: z.union([z.string(), z.number()]).optional().default(""),
    files: z.array(fileItemSchema).optional().default([]),
    email: z.string().optional().default(""),
});
export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

// --- Update ---
export const updateDocumentSchema = z.object({
    luas_sales: z.union([z.string(), z.number()]).optional(),
    luas_parkir: z.union([z.string(), z.number()]).optional(),
    luas_gudang: z.union([z.string(), z.number()]).optional(),
    luas_bangunan_lantai_1: z.union([z.string(), z.number()]).optional(),
    luas_bangunan_lantai_2: z.union([z.string(), z.number()]).optional(),
    luas_bangunan_lantai_3: z.union([z.string(), z.number()]).optional(),
    total_luas_bangunan: z.union([z.string(), z.number()]).optional(),
    luas_area_terbuka: z.union([z.string(), z.number()]).optional(),
    tinggi_plafon: z.union([z.string(), z.number()]).optional(),
    files: z.array(fileItemSchema).optional().default([]),
    email: z.string().optional().default(""),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
