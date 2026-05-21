import { z } from "zod";

export const penyimpananDokumenCreateSchema = z.object({
    id_toko: z.coerce.number().int().positive(),
    nama_dokumen: z.string().trim().min(1),
    folder_name: z.string().trim().min(1).optional()
});

export const penyimpananDokumenUpdateSchema = z.object({
    nama_dokumen: z.string().trim().min(1).optional()
});

export const penyimpananDokumenListQuerySchema = z.object({
    id_toko: z.coerce.number().int().positive().optional(),
    nama_dokumen: z.string().trim().min(1).optional(),
    kode_toko: z.string().trim().min(1).optional(),
    nama_toko: z.string().trim().min(1).optional(),
    cabang: z.string().trim().min(1).optional()
});

export const penyimpananDokumenMigrationSchema = z.object({
    actor_role: z.string().trim().min(1)
});

export const penyimpananDokumenIdParamSchema = z.object({
    id: z.coerce.number().int().positive()
});

export type PenyimpananDokumenCreateInput = z.infer<typeof penyimpananDokumenCreateSchema>;
export type PenyimpananDokumenUpdateInput = z.infer<typeof penyimpananDokumenUpdateSchema>;
export type PenyimpananDokumenListQueryInput = z.infer<typeof penyimpananDokumenListQuerySchema>;
