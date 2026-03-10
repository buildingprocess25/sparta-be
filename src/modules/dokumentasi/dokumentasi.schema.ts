import { z } from "zod";

const stringOrNumber = z.union([z.string(), z.number()]);

export const loginDokumentasiSchema = z.object({
    username: z.string(),
    password: z.string(),
});
export type LoginDokumentasiInput = z.infer<typeof loginDokumentasiSchema>;

export const spkDataSchema = z.object({
    cabang: z.string().optional().default(""),
});
export type SpkDataInput = z.infer<typeof spkDataSchema>;

export const saveTempSchema = z.object({
    nomorUlok: z.string().min(1),
    namaToko: z.string().optional().default(""),
    kodeToko: z.string().optional().default(""),
    cabang: z.string().optional().default(""),
    tanggalGo: z.string().optional().default(""),
    tanggalSt: z.string().optional().default(""),
    tanggalAmbilFoto: z.string().optional().default(""),
    spkAwal: z.string().optional().default(""),
    spkAkhir: z.string().optional().default(""),
    kontraktorSipil: z.string().optional().default(""),
    kontraktorMe: z.string().optional().default(""),
    emailPengirim: z.string().optional().default(""),
    photoId: stringOrNumber.optional(),
    photoBase64: z.string().optional(),
    photoNote: z.string().optional().default(""),
});
export type SaveTempInput = z.infer<typeof saveTempSchema>;

export const getTempSchema = z.object({
    nomorUlok: z.string().min(1),
});
export type GetTempInput = z.infer<typeof getTempSchema>;

export const cekStatusSchema = z.object({
    nomorUlok: z.string().min(1),
});
export type CekStatusInput = z.infer<typeof cekStatusSchema>;

export const saveTokoSchema = z.object({
    nomorUlok: z.string().min(1),
    namaToko: z.string().optional().default(""),
    kodeToko: z.string().optional().default(""),
    cabang: z.string().optional().default(""),
    tanggalGo: z.string().optional().default(""),
    tanggalSt: z.string().optional().default(""),
    tanggalAmbilFoto: z.string().optional().default(""),
    spkAwal: z.string().optional().default(""),
    spkAkhir: z.string().optional().default(""),
    kontraktorSipil: z.string().optional().default(""),
    kontraktorMe: z.string().optional().default(""),
    emailPengirim: z.string().optional().default(""),
    pdfBase64: z.string().optional(),
    photoUrls: z.array(z.string()).optional().default([]),
    photosBase64: z.array(z.string()).optional().default([]),
    statusValidasi: z.string().optional().default("MENUNGGU VALIDASI"),
    validator: z.string().optional().default(""),
    waktuValidasi: z.string().optional().default(""),
    catatanRevisi: z.string().optional().default(""),
    deleteTemp: z.boolean().optional().default(false),
});
export type SaveTokoInput = z.infer<typeof saveTokoSchema>;

export const sendPdfEmailSchema = z.object({
    nomorUlok: z.string().min(1),
    cabang: z.string().min(1),
    namaToko: z.string().optional().default(""),
    pdfUrl: z.string().optional().default(""),
    pdfBase64: z.string().optional(),
    emailPengirim: z.string().optional().default(""),
});
export type SendPdfEmailInput = z.infer<typeof sendPdfEmailSchema>;

export const validateQuerySchema = z.object({
    ulok: z.string().optional().default(""),
    status: z.string().optional().default(""),
    catatan: z.string().optional().default(""),
    validator: z.string().optional().default("Email Validator"),
});
export type ValidateQueryInput = z.infer<typeof validateQuerySchema>;
