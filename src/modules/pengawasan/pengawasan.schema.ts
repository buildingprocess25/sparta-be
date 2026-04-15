import { z } from "zod";

export const pengawasanStatusSchema = z.enum(["progress", "selesai", "terlambat"]);

export const createPengawasanSchema = z.object({
    id_gantt: z.coerce.number().int().positive(),
    tanggal_pengawasan: z.string().trim().min(1),
    kategori_pekerjaan: z.string().trim().min(1),
    jenis_pekerjaan: z.string().trim().min(1),
    catatan: z.string().trim().min(1).optional(),
    status: pengawasanStatusSchema.optional()
});

export const bulkCreatePengawasanSchema = z.object({
    items: z.array(createPengawasanSchema).min(1)
});

export const updatePengawasanSchema = z.object({
    kategori_pekerjaan: z.string().trim().min(1).optional(),
    jenis_pekerjaan: z.string().trim().min(1).optional(),
    catatan: z.string().trim().min(1).optional(),
    dokumentasi: z.string().trim().min(1).optional(),
    status: pengawasanStatusSchema.optional()
}).refine(
    (data: {
        kategori_pekerjaan?: string;
        jenis_pekerjaan?: string;
        catatan?: string;
        dokumentasi?: string;
        status?: "progress" | "selesai" | "terlambat";
    }) =>
        typeof data.kategori_pekerjaan !== "undefined"
        || typeof data.jenis_pekerjaan !== "undefined"
        || typeof data.catatan !== "undefined"
        || typeof data.dokumentasi !== "undefined"
        || typeof data.status !== "undefined",
    { message: "Minimal satu field harus diisi untuk update" }
);

export const listPengawasanQuerySchema = z.object({
    id_gantt: z.coerce.number().int().positive().optional(),
    tanggal: z.string().trim().min(1).optional(),
    kategori_pekerjaan: z.string().trim().min(1).optional(),
    jenis_pekerjaan: z.string().trim().min(1).optional(),
    status: pengawasanStatusSchema.optional()
});

export type PengawasanStatusInput = z.infer<typeof pengawasanStatusSchema>;
export type CreatePengawasanInput = z.infer<typeof createPengawasanSchema>;
export type CreatePengawasanData = Omit<CreatePengawasanInput, "tanggal_pengawasan"> & {
    id_pengawasan_gantt: number;
    dokumentasi?: string;
};
export type BulkCreatePengawasanInput = z.infer<typeof bulkCreatePengawasanSchema>;
export type UpdatePengawasanInput = z.infer<typeof updatePengawasanSchema>;
export type ListPengawasanQueryInput = z.infer<typeof listPengawasanQuerySchema>;
