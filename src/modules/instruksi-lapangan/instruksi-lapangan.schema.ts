import { z } from "zod";

export const instruksiLapanganItemSchema = z.object({
    kategori_pekerjaan: z.string().min(1),
    jenis_pekerjaan: z.string().min(1),
    satuan: z.string().min(1),
    volume: z.coerce.number().nonnegative(),
    harga_material: z.coerce.number().nonnegative(),
    harga_upah: z.coerce.number().nonnegative(),
});

export const submitInstruksiLapanganSchema = z.object({
    nomor_ulok: z.string().min(1),
    email_pembuat: z.string().email(),
    
    // Optional file from frontend
    lampiran: z.string().optional(),
    
    // Items
    detail_items: z.array(instruksiLapanganItemSchema).min(1)
});

export const listInstruksiLapanganQuerySchema = z.object({
    status: z.string().optional(),
    nomor_ulok: z.string().optional(),
    cabang: z.string().optional(),
    email_pembuat: z.string().optional()
});

export type SubmitInstruksiLapanganInput = z.infer<typeof submitInstruksiLapanganSchema>;
export type InstruksiLapanganItemInput = z.infer<typeof instruksiLapanganItemSchema>;
export type ListInstruksiLapanganQuery = z.infer<typeof listInstruksiLapanganQuerySchema>;
