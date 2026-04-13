import { z } from "zod";

export const pengawasanStatusSchema = z.enum(["active", "terkunci"]);

export const createPengawasanSchema = z.object({
    id_gantt: z.coerce.number().int().positive(),
    kategori_pekerjaan: z.string().trim().min(1),
    jenis_pekerjaan: z.string().trim().min(1),
    status: pengawasanStatusSchema.optional()
});

export const bulkCreatePengawasanSchema = z.object({
    items: z.array(createPengawasanSchema).min(1)
});

export const updatePengawasanSchema = z.object({
    kategori_pekerjaan: z.string().trim().min(1).optional(),
    jenis_pekerjaan: z.string().trim().min(1).optional(),
    status: pengawasanStatusSchema.optional()
}).refine(
    (data) =>
        typeof data.kategori_pekerjaan !== "undefined"
        || typeof data.jenis_pekerjaan !== "undefined"
        || typeof data.status !== "undefined",
    { message: "Minimal satu field harus diisi untuk update" }
);

export const listPengawasanQuerySchema = z.object({
    id_gantt: z.coerce.number().int().positive().optional(),
    kategori_pekerjaan: z.string().trim().min(1).optional(),
    jenis_pekerjaan: z.string().trim().min(1).optional(),
    status: pengawasanStatusSchema.optional()
});

export type PengawasanStatusInput = z.infer<typeof pengawasanStatusSchema>;
export type CreatePengawasanInput = z.infer<typeof createPengawasanSchema>;
export type BulkCreatePengawasanInput = z.infer<typeof bulkCreatePengawasanSchema>;
export type UpdatePengawasanInput = z.infer<typeof updatePengawasanSchema>;
export type ListPengawasanQueryInput = z.infer<typeof listPengawasanQuerySchema>;
