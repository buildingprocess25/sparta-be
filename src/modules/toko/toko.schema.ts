import { z } from "zod";

export const createTokoSchema = z.object({
    nomor_ulok: z.string().min(1),
    nama_toko: z.string().min(1),
    kode_toko: z.string().min(1),
    cabang: z.string().min(1),
    alamat: z.string().min(1)
});

export type CreateTokoInput = z.infer<typeof createTokoSchema>;

export const listTokoQuerySchema = z.object({
    search: z.string().trim().min(1).optional(),
    cabang: z.string().trim().min(1).optional()
});

export type ListTokoQueryInput = z.infer<typeof listTokoQuerySchema>;

export const loginUserCabangSchema = z.object({
    email_sat: z.string().trim(),
    cabang: z.string().trim().min(1)
});

export type LoginUserCabangInput = z.infer<typeof loginUserCabangSchema>;

export const getTokoDetailQuerySchema = z.object({
    id: z.coerce.number().positive().optional(),
    nomor_ulok: z.string().trim().min(1).optional(),
    lingkup: z.string().trim().min(1).optional()
}).refine(data => data.id || data.nomor_ulok, {
    message: "Harus memberikan minimal id atau nomor_ulok",
    path: ["id", "nomor_ulok"]
});

export type GetTokoDetailQueryInput = z.infer<typeof getTokoDetailQuerySchema>;

export const updateTokoByIdParamSchema = z.object({
    id: z.coerce.number().positive()
});

export const updateTokoByIdBodySchema = z.object({
    nomor_ulok: z.string().min(1).optional(),
    nama_toko: z.string().min(1).optional(),
    kode_toko: z.string().min(1).optional(),
    cabang: z.string().min(1).optional(),
    alamat: z.string().min(1).optional()
}).refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi"
});

export type UpdateTokoByIdBodyInput = z.infer<typeof updateTokoByIdBodySchema>;
