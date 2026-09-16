const { z } = require('zod');

const submitTakeoverInspectionSchema = z.object({
    nomor_ulok: z.string().min(1),
    tanggal_takeover: z.string().min(1),
    items: z.array(z.object({
        id_gantt: z.number(),
        kategori_pekerjaan: z.string(),
        jenis_pekerjaan: z.string().nullable().optional(),
        status: z.enum(["Selesai", "Tidak Dikerjakan"]),
        opname_data: z.object({
            id_rab_item: z.number().optional(),
            id_instruksi_lapangan_item: z.number().optional(),
            volume_akhir: z.number(),
            selisih_volume: z.number(),
            total_selisih: z.number(),
            total_harga_opname: z.number(),
            desain: z.string(),
            kualitas: z.string(),
            spesifikasi: z.string(),
            catatan: z.string().optional()
        }).optional()
    }))
});

const payloadCandidate = {
    nomor_ulok: "Z001-1509-1111__ts__0",
    tanggal_takeover: "2026-09-22",
    items: [
        {
            id_gantt: 1,
            kategori_pekerjaan: "Bongkaran",
            jenis_pekerjaan: null,
            status: "Selesai",
            opname_data: {
                id_rab_item: 1,
                volume_akhir: 1,
                selisih_volume: 0,
                total_selisih: 0,
                total_harga_opname: 1000,
                desain: "Sesuai",
                kualitas: "Baik",
                spesifikasi: "Sesuai",
                catatan: ""
            }
        }
    ]
};

try {
    const payload = submitTakeoverInspectionSchema.parse(payloadCandidate);
    console.log("Validation Success!", JSON.stringify(payload, null, 2));
} catch (e) {
    console.error("Validation Error:", e.errors);
}
