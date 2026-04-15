import { z } from "zod";

// --- Sub-schemas ---

const nullableOptionalString = z.string().nullable().optional();

export const dayGanttItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    h_awal: z.string().min(1),
    h_akhir: z.string().min(1),
    keterlambatan: nullableOptionalString,
    kecepatan: nullableOptionalString
});

export const dependencyItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    kategori_pekerjaan_terikat: z.string().min(1)
});

export const pengawasanItemSchema = z.object({
    tanggal_pengawasan: z.string().min(1)
});

// --- Submit Gantt Chart ---

export const submitGanttSchema = z.object({
    // toko fields
    nomor_ulok: z.string().min(1),
    lingkup_pekerjaan: nullableOptionalString,
    nama_toko: nullableOptionalString,
    kode_toko: nullableOptionalString,
    proyek: nullableOptionalString,
    cabang: nullableOptionalString,
    alamat: nullableOptionalString,
    nama_kontraktor: nullableOptionalString,

    // gantt header
    email_pembuat: z.string().email(),

    // kategori pekerjaan + day items
    kategori_pekerjaan: z.array(z.string().min(1)).min(1),
    day_items: z.array(dayGanttItemSchema).min(1),

    // optional: pengawasan & dependency
    pengawasan: z.array(pengawasanItemSchema).optional(),
    dependencies: z.array(dependencyItemSchema).optional()
});

// --- Update Gantt Chart ---

export const updateGanttSchema = z.object({
    // kategori pekerjaan + day items
    kategori_pekerjaan: z.array(z.string().min(1)).min(1).optional(),
    day_items: z.array(dayGanttItemSchema).min(1).optional(),

    // optional: pengawasan & dependency
    pengawasan: z.array(pengawasanItemSchema).optional(),
    dependencies: z.array(dependencyItemSchema).optional()
});

// --- Lock Gantt Chart ---

export const lockGanttSchema = z.object({
    email: z.string().email()
});

// --- Query filters ---

export const ganttListQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional(),
    email_pembuat: z.string().optional()
});

export const ganttDetailQuerySchema = z.object({
    id_toko: z.string().regex(/^\d+$/, "id_toko harus berupa angka").optional()
});

// --- Add Day Items ---

export const addDayItemsSchema = z.object({
    day_items: z.array(dayGanttItemSchema).min(1)
});

// --- Update Keterlambatan ---

export const updateKeterlambatanSchema = z.object({
    kategori_pekerjaan: z.string().min(1).optional(),
    keterlambatan: z.string().optional(),
    updates: z.array(
        z.object({
            kategori_pekerjaan: z.string().min(1),
            keterlambatan: z.string()
        })
    ).min(1).optional()
}).refine(
    (data: {
        kategori_pekerjaan?: string;
        keterlambatan?: string;
        updates?: Array<{ kategori_pekerjaan: string; keterlambatan: string }>;
    }) =>
        (data.updates && data.updates.length > 0) ||
        (typeof data.kategori_pekerjaan === "string" && typeof data.keterlambatan === "string"),
    {
        message:
            "Gunakan field 'updates' untuk bulk update atau isi 'kategori_pekerjaan' + 'keterlambatan' untuk single update"
    }
);

// --- Update Kecepatan ---

export const updateKecepatanSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    h_awal: z.string().min(1),
    h_akhir: z.string().min(1),
    kecepatan: z.string()
});

// --- Manage Pengawasan ---

export const managePengawasanSchema = z.object({
    tanggal_pengawasan: z.union([
        z.string().min(1),
        z.array(z.string().min(1)).min(1)
    ]).optional(),
    remove_tanggal_pengawasan: z.string().min(1).optional()
}).refine(
    (data: { tanggal_pengawasan?: string | string[]; remove_tanggal_pengawasan?: string }) =>
        data.tanggal_pengawasan || data.remove_tanggal_pengawasan,
    { message: "Field 'tanggal_pengawasan' atau 'remove_tanggal_pengawasan' wajib diisi" }
);

// --- Detail by Toko ---

export const ganttDetailByTokoSchema = z.object({
    id_toko: z.string().min(1).regex(/^\d+$/, "id_toko harus berupa angka")
});

// --- Types ---

export type GanttDetailByTokoParams = z.infer<typeof ganttDetailByTokoSchema>;
export type SubmitGanttInput = z.infer<typeof submitGanttSchema>;
export type UpdateGanttInput = z.infer<typeof updateGanttSchema>;
export type LockGanttInput = z.infer<typeof lockGanttSchema>;
export type DayGanttItemInput = z.infer<typeof dayGanttItemSchema>;
export type DependencyItemInput = z.infer<typeof dependencyItemSchema>;
export type PengawasanItemInput = z.infer<typeof pengawasanItemSchema>;
export type GanttListQuery = z.infer<typeof ganttListQuerySchema>;
export type GanttDetailQuery = z.infer<typeof ganttDetailQuerySchema>;
export type AddDayItemsInput = z.infer<typeof addDayItemsSchema>;
export type UpdateKeterlambatanInput = z.infer<typeof updateKeterlambatanSchema>;
export type UpdateKecepatanInput = z.infer<typeof updateKecepatanSchema>;
export type ManagePengawasanInput = z.infer<typeof managePengawasanSchema>;
