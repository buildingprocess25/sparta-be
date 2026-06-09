import { z } from "zod";

export const activityLogEntityTypeSchema = z.enum([
    "RAB",
    "SPK",
    "PERTAMBAHAN_SPK",
    "OPNAME",
    "OPNAME_FINAL",
    "PENGAWASAN",
    "BERKAS_SERAH_TERIMA",
    "INSTRUKSI_LAPANGAN",
    "PROJECT_PLANNING",
    "DOKUMENTASI_BANGUNAN",
    "PENYIMPANAN_DOKUMEN"
]);

export const activityLogListQuerySchema = z.object({
    entity_type: activityLogEntityTypeSchema,
    entity_id: z.coerce.number().int().nonnegative()
});

export type ActivityLogListQueryInput = z.infer<typeof activityLogListQuerySchema>;
