import { pool } from "../../db/pool";
import type { DashboardAllQueryInput, DashboardQueryInput } from "./dashboard.schema";

export type DashboardTokoRow = {
    id: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

export type DashboardRabRow = {
    id: number;
    id_toko: number;
    no_sph: number | null;
    status: string | null;
    proyek: string | null;  // ✅ ADD: Missing field
    lingkup_pekerjaan: string | null;  // ✅ ADD: Missing field
    nama_pt: string | null;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    link_pdf_sph: string | null;
    logo: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    alasan_penolakan: string | null;
    waktu_penolakan: string | null;
    ditolak_oleh: string | null;
    durasi_pekerjaan: string | null;
    kategori_lokasi: string | null;
    no_polis: string | null;
    berlaku_polis: string | null;
    file_asuransi: string | null;
    luas_bangunan: string | null;
    luas_terbangun: string | null;
    luas_area_terbuka: string | null;
    luas_area_parkir: string | null;
    luas_area_sales: string | null;
    luas_gudang: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string | null;
};

export type DashboardRabItemRow = {
    id: number;
    id_rab: number;
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    volume: string | null;
    harga_material: string | null;
    harga_upah: string | null;
    total_material: string | null;
    total_upah: string | null;
    total_harga: string | null;
    catatan: string | null;
};

export type DashboardGanttRow = {
    id: number;
    id_toko: number;
    status: string | null;
    email_pembuat: string | null;
    timestamp: string | null;
};

export type DashboardKategoriGanttRow = {
    id: number;
    id_gantt: number;
    kategori_pekerjaan: string | null;
};

export type DashboardDayGanttRow = {
    id: number;
    id_gantt: number;
    id_kategori_pekerjaan_gantt: number | null;
    h_awal: string | null;
    h_akhir: string | null;
    keterlambatan: string | null;
    kecepatan: string | null;
};

export type DashboardPengawasanGanttRow = {
    id: number;
    id_gantt: number;
    id_pic_pengawasan: number | null;
    tanggal_pengawasan: string | null;
};

export type DashboardPengawasanRow = {
    id: number;
    id_gantt: number;
    id_pengawasan_gantt: number | null;
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    catatan: string | null;
    dokumentasi: string | null;
    status: string | null;
    created_at: string | null;
};

export type DashboardDependencyGanttRow = {
    id: number;
    id_gantt: number;
    id_kategori: number | null;
    id_kategori_terikat: number | null;
};

export type DashboardBerkasPengawasanRow = {
    id: number;
    id_pengawasan_gantt: number;
    link_pdf_pengawasan: string | null;
    created_at: string | null;
};

export type DashboardPengawasanPdfPendingRow = {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    h_day: number;
    tanggal_pengawasan: string | null;
    link_pdf_pengawasan: string;
    source_sheet: string;
    source_row: number;
    status: string;
    created_at: string | null;
};

export type DashboardSpkRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    lingkup_pekerjaan: string;
    nama_kontraktor: string;
    proyek: string;
    waktu_mulai: string;
    durasi: number;
    waktu_selesai: string;
    grand_total: string | number;
    terbilang: string;
    nomor_spk: string;
    par: string | null;
    spk_manual_1: string | null;
    spk_manual_2: string | null;
    status: string;
    link_pdf: string | null;
    approver_email: string | null;
    waktu_persetujuan: string | null;
    alasan_penolakan: string | null;
    created_at: string | null;
};

export type DashboardSpkApprovalLogRow = {
    id: number;
    pengajuan_spk_id: number;
    approver_email: string;
    tindakan: string;
    alasan_penolakan: string | null;
    waktu_tindakan: string | null;
};

export type DashboardPertambahanSpkRow = {
    id: number;
    id_spk: number;
    pertambahan_hari: string;
    tanggal_spk_akhir: string;
    tanggal_spk_akhir_setelah_perpanjangan: string;
    alasan_perpanjangan: string;
    dibuat_oleh: string;
    status_persetujuan: string;
    disetujui_oleh: string | null;
    waktu_persetujuan: string | null;
    alasan_penolakan: string | null;
    link_pdf: string | null;
    link_lampiran_pendukung: string | null;
    created_at: string | null;
};

export type DashboardPicPengawasanRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string;
    durasi: string;
    tanggal_mulai_spk: string;
    plc_building_support: string;
    created_at: string | null;
};

export type DashboardInstruksiLapanganRow = {
    id: number;
    id_toko: number;
    status: string | null;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    link_lampiran: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    pemberi_persetujuan_kontraktor: string | null;
    waktu_persetujuan_kontraktor: string | null;
    alasan_penolakan: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string | null;
};

export type DashboardInstruksiLapanganItemRow = {
    id: number;
    id_instruksi_lapangan: number;
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    volume: number | null;
    harga_material: number | null;
    harga_upah: number | null;
    total_material: number | null;
    total_upah: number | null;
    total_harga: number | null;
};

export type DashboardOpnameFinalRow = {
    id: number;
    id_toko: number;
    tipe_opname: string | null;
    aksi: string | null;
    status_opname_final: string | null;
    link_pdf_opname: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    alasan_penolakan: string | null;
    grand_total_opname: string | null;
    grand_total_rab: string | null;
    hari_denda: number | null;
    nilai_denda: string | null;
    tanggal_akhir_spk_denda: string | null;
    tanggal_serah_terima_denda: string | null;
    created_at: string | null;
    grand_total_final: string | null;
};

export type DashboardOpnameItemRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    id_rab_item: number;
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    status: string | null;
    volume_akhir: number | null;
    selisih_volume: number | null;
    total_selisih: number | null;
    total_harga_opname: number | null;
    desain: string | null;
    kualitas: string | null;
    spesifikasi: string | null;
    foto: string | null;
    catatan: string | null;
    created_at: string | null;
};

export type DashboardBerkasSerahTerimaRow = {
    id: number;
    id_toko: number;
    link_pdf: string | null;
    created_at: string | null;
};

export type DashboardProjectPlanningRow = {
    id: number;
    id_toko: number | null;
    nomor_ulok: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    proyek: string | null;
    lingkup_pekerjaan: string | null;
    jenis_proyek: string | null;
    estimasi_biaya: string | null;
    nama_pengaju: string | null;
    nama_lokasi: string | null;
    jenis_pengajuan: string | null;
    status: string | null;
    luas_bangunan: string | null;
    luas_area_terbuka: string | null;
    luas_area_terbangun: string | null;
    luas_gudang: string | null;
    luas_area_parkir: string | null;
    luas_area_sales: string | null;
    bm_waktu_persetujuan: string | null;
    created_at: string | null;
};

export type DashboardDokumentasiBangunanRow = {
    nomor_ulok: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    tanggal_go: string | null;
    created_at: string | null;
};

export type DashboardData = {
    toko: DashboardTokoRow;
    rab: Array<DashboardRabRow & { items: DashboardRabItemRow[] }>;
    gantt: Array<DashboardGanttRow & {
        kategori_pekerjaan: DashboardKategoriGanttRow[];
        day_items: DashboardDayGanttRow[];
        pengawasan_gantt: DashboardPengawasanGanttRow[];
        pengawasan: DashboardPengawasanRow[];
        dependencies: DashboardDependencyGanttRow[];
        berkas_pengawasan: DashboardBerkasPengawasanRow[];
    }>;
    spk: Array<DashboardSpkRow & {
        approval_logs: DashboardSpkApprovalLogRow[];
        pertambahan_spk: DashboardPertambahanSpkRow[];
    }>;
    pic_pengawasan: DashboardPicPengawasanRow | null;
    pengawasan_pdf_pending: DashboardPengawasanPdfPendingRow[];
    instruksi_lapangan: Array<DashboardInstruksiLapanganRow & { items: DashboardInstruksiLapanganItemRow[] }>;
    opname_final: Array<DashboardOpnameFinalRow & { items: DashboardOpnameItemRow[] }>;
    berkas_serah_terima: DashboardBerkasSerahTerimaRow[];
    project_planning: DashboardProjectPlanningRow[];
};

const toArrayParam = (values: number[]) => values.length > 0 ? values : [0];

const pushMapArray = <T>(map: Map<number, T[]>, key: number | string, value: T) => {
    const numericKey = Number(key);
    const items = map.get(numericKey) ?? [];
    items.push(value);
    map.set(numericKey, items);
};

const normalizeDashboardUlok = (value: string | null | undefined) => String(value || "").trim().toUpperCase();
const normalizeDashboardScope = (value: string | null | undefined) => String(value || "").trim().toUpperCase();
const dashboardScopeKey = (nomorUlok: string | null | undefined, lingkup: string | null | undefined) =>
    `${normalizeDashboardUlok(nomorUlok)}\u0000${normalizeDashboardScope(lingkup)}`;

export const dashboardRepository = {
    async findTokoByQuery(query: DashboardQueryInput): Promise<DashboardTokoRow | null> {
        const filters: string[] = [];
        const values: Array<string | number> = [];

        if (query.id) {
            values.push(query.id);
            filters.push(`id = $${values.length}`);
        } else if (query.search) {
            values.push(`%${query.search}%`);
            const idx = values.length;
            filters.push(
                `(nomor_ulok ILIKE $${idx} OR nama_toko ILIKE $${idx} OR kode_toko ILIKE $${idx} OR cabang ILIKE $${idx} OR CAST(id AS TEXT) ILIKE $${idx})`
            );
        }

        if (filters.length === 0) {
            return null;
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const result = await pool.query<DashboardTokoRow>(
            `
            SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
            FROM toko
            ${whereClause}
            ORDER BY id DESC
            LIMIT 1
            `,
            values
        );

        return result.rows[0] ?? null;
    },

    async findDashboardByTokoId(tokoId: number): Promise<DashboardData> {
        const tokoResult = await pool.query<DashboardTokoRow>(
            `
            SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
            FROM toko
            WHERE id = $1
            LIMIT 1
            `,
            [tokoId]
        );

        const toko = tokoResult.rows[0];

        const rabResult = await pool.query<DashboardRabRow>(
            `
            SELECT r.id, r.id_toko, r.no_sph, r.status, t.proyek, 
                   t.lingkup_pekerjaan, r.nama_pt, r.link_pdf_gabungan, r.link_pdf_non_sbo, r.link_pdf_rekapitulasi,
                   r.link_pdf_sph, r.logo, r.email_pembuat, r.pemberi_persetujuan_direktur, r.waktu_persetujuan_direktur,
                   r.pemberi_persetujuan_koordinator, r.waktu_persetujuan_koordinator, r.pemberi_persetujuan_manager,
                   r.waktu_persetujuan_manager, r.alasan_penolakan, r.waktu_penolakan, r.ditolak_oleh, r.durasi_pekerjaan,
                   r.kategori_lokasi, r.no_polis, r.berlaku_polis, r.file_asuransi, r.luas_bangunan, r.luas_terbangun,
                   r.luas_area_terbuka, r.luas_area_parkir, r.luas_area_sales, r.luas_gudang, r.grand_total,
                   r.grand_total_non_sbo, r.grand_total_final, r.created_at
            FROM rab r
            LEFT JOIN toko t ON t.id = r.id_toko
            WHERE r.id_toko = $1
            ORDER BY r.created_at DESC, r.id DESC
            `,
            [tokoId]
        );

        const rabIds = rabResult.rows.map((row) => row.id);
        const rabItemResult = await pool.query<DashboardRabItemRow>(
            `
            SELECT id, id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan, volume, harga_material, harga_upah,
                   total_material, total_upah, total_harga, catatan
            FROM rab_item
            WHERE id_rab = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(rabIds)]
        );

        const ganttResult = await pool.query<DashboardGanttRow>(
            `
            SELECT id, id_toko, status, email_pembuat, timestamp
            FROM gantt_chart
            WHERE id_toko = $1
            ORDER BY id DESC
            `,
            [tokoId]
        );

        const ganttIds = ganttResult.rows.map((row) => row.id);

        const [
            kategoriResult,
            dayResult,
            pengawasanGanttResult,
            pengawasanResult,
            dependencyResult
        ] = await Promise.all([
            pool.query<DashboardKategoriGanttRow>(
                `
                SELECT id, id_gantt, kategori_pekerjaan
                FROM kategori_pekerjaan_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            pool.query<DashboardDayGanttRow>(
                `
                SELECT id, id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan
                FROM day_gantt_chart
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            pool.query<DashboardPengawasanGanttRow>(
                `
                SELECT id, id_gantt, id_pic_pengawasan, tanggal_pengawasan
                FROM pengawasan_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            pool.query<DashboardPengawasanRow>(
                `
                SELECT id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan,
                       dokumentasi, status, created_at
                FROM pengawasan
                WHERE id_gantt = ANY($1::int[])
                ORDER BY created_at ASC, id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            pool.query<DashboardDependencyGanttRow>(
                `
                SELECT id, id_gantt, id_kategori, id_kategori_terikat
                FROM dependency_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            )
        ]);

        const pengawasanGanttIds = pengawasanGanttResult.rows.map((row) => row.id);
        const berkasPengawasanResult = await pool.query<DashboardBerkasPengawasanRow>(
            `
            SELECT id, id_pengawasan_gantt, link_pdf_pengawasan, created_at
            FROM berkas_pengawasan
            WHERE id_pengawasan_gantt = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(pengawasanGanttIds)]
        );

        const spkResult = await pool.query<DashboardSpkRow>(
            `
            SELECT id, id_toko, nomor_ulok, email_pembuat, lingkup_pekerjaan, nama_kontraktor, proyek,
                   waktu_mulai, durasi, waktu_selesai, grand_total, terbilang, nomor_spk, par,
                   spk_manual_1, spk_manual_2, status, link_pdf, approver_email, waktu_persetujuan,
                   alasan_penolakan, created_at
            FROM pengajuan_spk
            WHERE id_toko = $1
               OR (
                   id_toko IS NULL
                   AND $2::text IS NOT NULL
                   AND nomor_ulok = $2::text
                   AND LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER(COALESCE($3::text, ''))
               )
            ORDER BY created_at DESC, id DESC
            `,
            [tokoId, toko?.nomor_ulok ?? null, toko?.lingkup_pekerjaan ?? null]
        );

        const spkIds = spkResult.rows.map((row) => row.id);

        const [spkLogResult, pertambahanResult] = await Promise.all([
            pool.query<DashboardSpkApprovalLogRow>(
                `
                SELECT id, pengajuan_spk_id, approver_email, tindakan, alasan_penolakan, waktu_tindakan
                FROM spk_approval_log
                WHERE pengajuan_spk_id = ANY($1::int[])
                ORDER BY waktu_tindakan DESC, id DESC
                `,
                [toArrayParam(spkIds)]
            ),
            pool.query<DashboardPertambahanSpkRow>(
                `
                SELECT id, id_spk, pertambahan_hari, tanggal_spk_akhir, tanggal_spk_akhir_setelah_perpanjangan,
                       alasan_perpanjangan, dibuat_oleh, status_persetujuan, disetujui_oleh, waktu_persetujuan,
                       alasan_penolakan, link_pdf, link_lampiran_pendukung, created_at
                FROM pertambahan_spk
                WHERE id_spk = ANY($1::int[])
                ORDER BY created_at DESC, id DESC
                `,
                [toArrayParam(spkIds)]
            )
        ]);

        const picResult = await pool.query<DashboardPicPengawasanRow>(
            `
            SELECT id, id_toko, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk,
                   plc_building_support, created_at
            FROM pic_pengawasan
            WHERE id_toko = $1
            LIMIT 1
            `,
            [tokoId]
        );

        const instruksiResult = await pool.query<DashboardInstruksiLapanganRow>(
            `
            SELECT id, id_toko, status, link_pdf_gabungan, link_pdf_non_sbo, link_pdf_rekapitulasi, link_lampiran,
                   email_pembuat, pemberi_persetujuan_koordinator, waktu_persetujuan_koordinator,
                   pemberi_persetujuan_manager, waktu_persetujuan_manager, pemberi_persetujuan_kontraktor,
                   waktu_persetujuan_kontraktor, alasan_penolakan, grand_total, grand_total_non_sbo,
                   grand_total_final, created_at
            FROM instruksi_lapangan
            WHERE id_toko = $1
            ORDER BY created_at DESC, id DESC
            `,
            [tokoId]
        );

        const instruksiIds = instruksiResult.rows.map((row) => row.id);
        const instruksiItemResult = await pool.query<DashboardInstruksiLapanganItemRow>(
            `
            SELECT id, id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan, satuan, volume,
                   harga_material, harga_upah, total_material, total_upah, total_harga
            FROM instruksi_lapangan_item
            WHERE id_instruksi_lapangan = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(instruksiIds)]
        );

        const opnameFinalResult = await pool.query<DashboardOpnameFinalRow>(
            `
            SELECT id, id_toko, tipe_opname, aksi, status_opname_final, link_pdf_opname, email_pembuat,
                   pemberi_persetujuan_direktur, waktu_persetujuan_direktur, pemberi_persetujuan_koordinator,
                   waktu_persetujuan_koordinator, pemberi_persetujuan_manager, waktu_persetujuan_manager,
                   alasan_penolakan, grand_total_opname, grand_total_rab, hari_denda, nilai_denda,
                   tanggal_akhir_spk_denda, tanggal_serah_terima_denda, created_at, grand_total_final
            FROM opname_final
            WHERE id_toko = $1
            ORDER BY created_at DESC, id DESC
            `,
            [tokoId]
        );

        const opnameFinalIds = opnameFinalResult.rows.map((row) => row.id);
        const opnameItemResult = await pool.query<DashboardOpnameItemRow>(
            `
            SELECT oi.id, oi.id_toko, oi.id_opname_final, oi.id_rab_item,
                   ri.kategori_pekerjaan, ri.jenis_pekerjaan, ri.satuan,
                   oi.status, oi.volume_akhir, oi.selisih_volume, oi.total_selisih,
                   oi.total_harga_opname, oi.desain, oi.kualitas, oi.spesifikasi,
                   oi.foto, oi.catatan, oi.created_at
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            WHERE oi.id_opname_final = ANY($1::int[])
            ORDER BY oi.id ASC
            `,
            [toArrayParam(opnameFinalIds)]
        );

        const berkasSerahTerimaResult = await pool.query<DashboardBerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY created_at DESC, id DESC
            `,
            [tokoId]
        );

        const projectPlanningResult = await pool.query<DashboardProjectPlanningRow>(
            `
            SELECT id, id_toko, nomor_ulok, nama_toko, kode_toko, cabang, proyek, lingkup_pekerjaan,
                   jenis_proyek, estimasi_biaya, nama_pengaju, nama_lokasi, jenis_pengajuan,
                   status, luas_bangunan, luas_area_terbuka, luas_area_terbangun, luas_gudang,
                   luas_area_parkir, luas_area_sales, bm_waktu_persetujuan, created_at
            FROM projek_planning
            WHERE id_toko = $1
            ORDER BY created_at DESC, id DESC
            `,
            [tokoId]
        );

        const pengawasanPdfPendingResult = await pool.query<DashboardPengawasanPdfPendingRow>(
            `
            SELECT id, nomor_ulok, lingkup_pekerjaan, h_day, tanggal_pengawasan,
                   link_pdf_pengawasan, source_sheet, source_row, status, created_at
            FROM pengawasan_pdf_migration_pending
            WHERE status = 'PENDING'
              AND UPPER(nomor_ulok) = UPPER($1)
            ORDER BY created_at DESC, id DESC
            `,
            [toko?.nomor_ulok ?? ""]
        );

        const rabItemsByRabId = new Map<number, DashboardRabItemRow[]>();
        for (const item of rabItemResult.rows) {
            const items = rabItemsByRabId.get(item.id_rab) ?? [];
            items.push(item);
            rabItemsByRabId.set(item.id_rab, items);
        }

        const rab = rabResult.rows.map((row) => ({
            ...row,
            items: rabItemsByRabId.get(row.id) ?? []
        }));

        const kategoriByGanttId = new Map<number, DashboardKategoriGanttRow[]>();
        for (const row of kategoriResult.rows) {
            const items = kategoriByGanttId.get(row.id_gantt) ?? [];
            items.push(row);
            kategoriByGanttId.set(row.id_gantt, items);
        }

        const dayByGanttId = new Map<number, DashboardDayGanttRow[]>();
        for (const row of dayResult.rows) {
            const items = dayByGanttId.get(row.id_gantt) ?? [];
            items.push(row);
            dayByGanttId.set(row.id_gantt, items);
        }

        const pengawasanGanttByGanttId = new Map<number, DashboardPengawasanGanttRow[]>();
        for (const row of pengawasanGanttResult.rows) {
            const items = pengawasanGanttByGanttId.get(row.id_gantt) ?? [];
            items.push(row);
            pengawasanGanttByGanttId.set(row.id_gantt, items);
        }

        const pengawasanByGanttId = new Map<number, DashboardPengawasanRow[]>();
        for (const row of pengawasanResult.rows) {
            const items = pengawasanByGanttId.get(row.id_gantt) ?? [];
            items.push(row);
            pengawasanByGanttId.set(row.id_gantt, items);
        }

        const dependencyByGanttId = new Map<number, DashboardDependencyGanttRow[]>();
        for (const row of dependencyResult.rows) {
            const items = dependencyByGanttId.get(row.id_gantt) ?? [];
            items.push(row);
            dependencyByGanttId.set(row.id_gantt, items);
        }

        const berkasByPengawasanGanttId = new Map<number, DashboardBerkasPengawasanRow[]>();
        for (const row of berkasPengawasanResult.rows) {
            const items = berkasByPengawasanGanttId.get(row.id_pengawasan_gantt) ?? [];
            items.push(row);
            berkasByPengawasanGanttId.set(row.id_pengawasan_gantt, items);
        }

        const gantt = ganttResult.rows.map((row) => ({
            ...row,
            kategori_pekerjaan: kategoriByGanttId.get(row.id) ?? [],
            day_items: dayByGanttId.get(row.id) ?? [],
            pengawasan_gantt: pengawasanGanttByGanttId.get(row.id) ?? [],
            pengawasan: pengawasanByGanttId.get(row.id) ?? [],
            dependencies: dependencyByGanttId.get(row.id) ?? [],
            berkas_pengawasan: (pengawasanGanttByGanttId.get(row.id) ?? [])
                .flatMap((item) => berkasByPengawasanGanttId.get(item.id) ?? [])
        }));

        const spkLogsBySpkId = new Map<number, DashboardSpkApprovalLogRow[]>();
        for (const row of spkLogResult.rows) {
            const items = spkLogsBySpkId.get(row.pengajuan_spk_id) ?? [];
            items.push(row);
            spkLogsBySpkId.set(row.pengajuan_spk_id, items);
        }

        const pertambahanBySpkId = new Map<number, DashboardPertambahanSpkRow[]>();
        for (const row of pertambahanResult.rows) {
            const items = pertambahanBySpkId.get(row.id_spk) ?? [];
            items.push(row);
            pertambahanBySpkId.set(row.id_spk, items);
        }

        const spk = spkResult.rows.map((row) => ({
            ...row,
            approval_logs: spkLogsBySpkId.get(row.id) ?? [],
            pertambahan_spk: pertambahanBySpkId.get(row.id) ?? []
        }));

        const instruksiItemsById = new Map<number, DashboardInstruksiLapanganItemRow[]>();
        for (const row of instruksiItemResult.rows) {
            const items = instruksiItemsById.get(row.id_instruksi_lapangan) ?? [];
            items.push(row);
            instruksiItemsById.set(row.id_instruksi_lapangan, items);
        }

        const instruksi_lapangan = instruksiResult.rows.map((row) => ({
            ...row,
            items: instruksiItemsById.get(row.id) ?? []
        }));

        const opnameItemsByFinalId = new Map<number, DashboardOpnameItemRow[]>();
        for (const row of opnameItemResult.rows) {
            const items = opnameItemsByFinalId.get(row.id_opname_final) ?? [];
            items.push(row);
            opnameItemsByFinalId.set(row.id_opname_final, items);
        }

        const opname_final = opnameFinalResult.rows.map((row) => ({
            ...row,
            items: opnameItemsByFinalId.get(row.id) ?? []
        }));

        return {
            toko,
            rab,
            gantt,
            spk,
            pic_pengawasan: picResult.rows[0] ?? null,
            pengawasan_pdf_pending: pengawasanPdfPendingResult.rows,
            instruksi_lapangan,
            opname_final,
            berkas_serah_terima: berkasSerahTerimaResult.rows,
            project_planning: projectPlanningResult.rows
        };
    },

    async findAllDashboard(query: DashboardAllQueryInput): Promise<DashboardData[]> {
        const client = await pool.connect();

        try {
        const filters: string[] = [];
        const values: Array<string | number> = [];

        if (query.search) {
            values.push(`%${query.search}%`);
            const idx = values.length;
            filters.push(
                `(nomor_ulok ILIKE $${idx} OR nama_toko ILIKE $${idx} OR kode_toko ILIKE $${idx} OR cabang ILIKE $${idx} OR CAST(id AS TEXT) ILIKE $${idx})`
            );
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const tokoResult = await client.query<DashboardTokoRow>(
            `
            SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
            FROM toko
            ${whereClause}
            ORDER BY id DESC
            `,
            values
        );

        if (tokoResult.rows.length === 0) {
            return [];
        }

        const tokoIds = tokoResult.rows.map((row) => row.id);
        const tokoIdsByUlok = new Map<string, number[]>();
        const tokoIdsByScopeKey = new Map<string, number[]>();
        for (const row of tokoResult.rows) {
            const ulokKey = normalizeDashboardUlok(row.nomor_ulok);
            if (ulokKey) {
                const ids = tokoIdsByUlok.get(ulokKey) ?? [];
                ids.push(row.id);
                tokoIdsByUlok.set(ulokKey, ids);
            }

            const scopeKey = dashboardScopeKey(row.nomor_ulok, row.lingkup_pekerjaan);
            const scopedIds = tokoIdsByScopeKey.get(scopeKey) ?? [];
            scopedIds.push(row.id);
            tokoIdsByScopeKey.set(scopeKey, scopedIds);
        }

        const rabResult = await client.query<DashboardRabRow>(
            `
            SELECT r.id, r.id_toko, r.no_sph, r.status, t.proyek, 
                   t.lingkup_pekerjaan, r.nama_pt, r.link_pdf_gabungan, r.link_pdf_non_sbo, r.link_pdf_rekapitulasi,
                   r.link_pdf_sph, r.logo, r.email_pembuat, r.pemberi_persetujuan_direktur, r.waktu_persetujuan_direktur,
                   r.pemberi_persetujuan_koordinator, r.waktu_persetujuan_koordinator, r.pemberi_persetujuan_manager,
                   r.waktu_persetujuan_manager, r.alasan_penolakan, r.waktu_penolakan, r.ditolak_oleh, r.durasi_pekerjaan,
                   r.kategori_lokasi, r.no_polis, r.berlaku_polis, r.file_asuransi, r.luas_bangunan, r.luas_terbangun,
                   r.luas_area_terbuka, r.luas_area_parkir, r.luas_area_sales, r.luas_gudang, r.grand_total,
                   r.grand_total_non_sbo, r.grand_total_final, r.created_at
            FROM rab r
            LEFT JOIN toko t ON t.id = r.id_toko
            WHERE r.id_toko = ANY($1::int[])
            ORDER BY r.created_at DESC, r.id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const rabIds = rabResult.rows.map((row) => row.id);
        const rabItemResult = await client.query<DashboardRabItemRow>(
            `
            SELECT id, id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan, volume, harga_material, harga_upah,
                   total_material, total_upah, total_harga, catatan
            FROM rab_item
            WHERE id_rab = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(rabIds)]
        );

        const ganttResult = await client.query<DashboardGanttRow>(
            `
            SELECT id, id_toko, status, email_pembuat, timestamp
            FROM gantt_chart
            WHERE id_toko = ANY($1::int[])
            ORDER BY id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const ganttIds = ganttResult.rows.map((row) => row.id);

        const [
            kategoriResult,
            dayResult,
            pengawasanGanttResult,
            pengawasanResult,
            dependencyResult
        ] = await Promise.all([
            client.query<DashboardKategoriGanttRow>(
                `
                SELECT id, id_gantt, kategori_pekerjaan
                FROM kategori_pekerjaan_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            client.query<DashboardDayGanttRow>(
                `
                SELECT id, id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan
                FROM day_gantt_chart
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            client.query<DashboardPengawasanGanttRow>(
                `
                SELECT id, id_gantt, id_pic_pengawasan, tanggal_pengawasan
                FROM pengawasan_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            client.query<DashboardPengawasanRow>(
                `
                SELECT id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan,
                       dokumentasi, status, created_at
                FROM pengawasan
                WHERE id_gantt = ANY($1::int[])
                ORDER BY created_at ASC, id ASC
                `,
                [toArrayParam(ganttIds)]
            ),
            client.query<DashboardDependencyGanttRow>(
                `
                SELECT id, id_gantt, id_kategori, id_kategori_terikat
                FROM dependency_gantt
                WHERE id_gantt = ANY($1::int[])
                ORDER BY id ASC
                `,
                [toArrayParam(ganttIds)]
            )
        ]);

        const pengawasanGanttIds = pengawasanGanttResult.rows.map((row) => row.id);
        const berkasPengawasanResult = await client.query<DashboardBerkasPengawasanRow>(
            `
            SELECT id, id_pengawasan_gantt, link_pdf_pengawasan, created_at
            FROM berkas_pengawasan
            WHERE id_pengawasan_gantt = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(pengawasanGanttIds)]
        );

        const spkResult = await client.query<DashboardSpkRow>(
            `
            SELECT p.id,
                   COALESCE(p.id_toko, t.id) AS id_toko,
                   p.nomor_ulok,
                   p.email_pembuat,
                   p.lingkup_pekerjaan,
                   p.nama_kontraktor,
                   p.proyek,
                   p.waktu_mulai,
                   p.durasi,
                   p.waktu_selesai,
                   p.grand_total,
                   p.terbilang,
                   p.nomor_spk,
                   p.par,
                   p.spk_manual_1,
                   p.spk_manual_2,
                   p.status,
                   p.link_pdf,
                   p.approver_email,
                   p.waktu_persetujuan,
                   p.alasan_penolakan,
                   p.created_at
            FROM pengajuan_spk p
            LEFT JOIN toko t
              ON t.nomor_ulok = p.nomor_ulok
             AND LOWER(COALESCE(t.lingkup_pekerjaan, '')) = LOWER(COALESCE(p.lingkup_pekerjaan, ''))
            WHERE COALESCE(p.id_toko, t.id) = ANY($1::int[])
            ORDER BY p.created_at DESC, p.id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const spkIds = spkResult.rows.map((row) => row.id);

        const [spkLogResult, pertambahanResult] = await Promise.all([
            client.query<DashboardSpkApprovalLogRow>(
                `
                SELECT id, pengajuan_spk_id, approver_email, tindakan, alasan_penolakan, waktu_tindakan
                FROM spk_approval_log
                WHERE pengajuan_spk_id = ANY($1::int[])
                ORDER BY waktu_tindakan DESC, id DESC
                `,
                [toArrayParam(spkIds)]
            ),
            client.query<DashboardPertambahanSpkRow>(
                `
                SELECT id, id_spk, pertambahan_hari, tanggal_spk_akhir, tanggal_spk_akhir_setelah_perpanjangan,
                       alasan_perpanjangan, dibuat_oleh, status_persetujuan, disetujui_oleh, waktu_persetujuan,
                       alasan_penolakan, link_pdf, link_lampiran_pendukung, created_at
                FROM pertambahan_spk
                WHERE id_spk = ANY($1::int[])
                ORDER BY created_at DESC, id DESC
                `,
                [toArrayParam(spkIds)]
            )
        ]);

        const picResult = await client.query<DashboardPicPengawasanRow>(
            `
            SELECT p.id,
                   COALESCE(p.id_toko, t.id) AS id_toko,
                   p.nomor_ulok,
                   p.id_rab,
                   p.id_spk,
                   p.kategori_lokasi,
                   p.durasi,
                   p.tanggal_mulai_spk,
                   p.plc_building_support,
                   p.created_at
            FROM pic_pengawasan p
            LEFT JOIN toko t ON t.nomor_ulok = p.nomor_ulok
            WHERE COALESCE(p.id_toko, t.id) = ANY($1::int[])
            `,
            [toArrayParam(tokoIds)]
        );

        const instruksiResult = await client.query<DashboardInstruksiLapanganRow>(
            `
            SELECT id, id_toko, status, link_pdf_gabungan, link_pdf_non_sbo, link_pdf_rekapitulasi, link_lampiran,
                   email_pembuat, pemberi_persetujuan_koordinator, waktu_persetujuan_koordinator,
                   pemberi_persetujuan_manager, waktu_persetujuan_manager, pemberi_persetujuan_kontraktor,
                   waktu_persetujuan_kontraktor, alasan_penolakan, grand_total, grand_total_non_sbo,
                   grand_total_final, created_at
            FROM instruksi_lapangan
            WHERE id_toko = ANY($1::int[])
            ORDER BY created_at DESC, id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const instruksiIds = instruksiResult.rows.map((row) => row.id);
        const instruksiItemResult = await client.query<DashboardInstruksiLapanganItemRow>(
            `
            SELECT id, id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan, satuan, volume,
                   harga_material, harga_upah, total_material, total_upah, total_harga
            FROM instruksi_lapangan_item
            WHERE id_instruksi_lapangan = ANY($1::int[])
            ORDER BY id ASC
            `,
            [toArrayParam(instruksiIds)]
        );

        const opnameFinalResult = await client.query<DashboardOpnameFinalRow>(
            `
            SELECT id, id_toko, tipe_opname, aksi, status_opname_final, link_pdf_opname, email_pembuat,
                   pemberi_persetujuan_direktur, waktu_persetujuan_direktur, pemberi_persetujuan_koordinator,
                   waktu_persetujuan_koordinator, pemberi_persetujuan_manager, waktu_persetujuan_manager,
                   alasan_penolakan, grand_total_opname, grand_total_rab, hari_denda, nilai_denda,
                   tanggal_akhir_spk_denda, tanggal_serah_terima_denda, created_at, grand_total_final
            FROM opname_final
            WHERE id_toko = ANY($1::int[])
            ORDER BY created_at DESC, id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const opnameFinalIds = opnameFinalResult.rows.map((row) => row.id);
        const opnameItemResult = await client.query<DashboardOpnameItemRow>(
            `
            SELECT oi.id, oi.id_toko, oi.id_opname_final, oi.id_rab_item,
                   ri.kategori_pekerjaan, ri.jenis_pekerjaan, ri.satuan,
                   oi.status, oi.volume_akhir, oi.selisih_volume, oi.total_selisih,
                   oi.total_harga_opname, oi.desain, oi.kualitas, oi.spesifikasi,
                   oi.foto, oi.catatan, oi.created_at
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            WHERE oi.id_opname_final = ANY($1::int[])
            ORDER BY oi.id ASC
            `,
            [toArrayParam(opnameFinalIds)]
        );

        const berkasSerahTerimaResult = await client.query<DashboardBerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = ANY($1::int[])
            ORDER BY created_at DESC, id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const projectPlanningResult = await client.query<DashboardProjectPlanningRow>(
            `
            SELECT id, id_toko, nomor_ulok, nama_toko, kode_toko, cabang, proyek, lingkup_pekerjaan,
                   jenis_proyek, estimasi_biaya, nama_pengaju, nama_lokasi, jenis_pengajuan,
                   status, luas_bangunan, luas_area_terbuka, luas_area_terbangun, luas_gudang,
                   luas_area_parkir, luas_area_sales, bm_waktu_persetujuan, created_at
            FROM projek_planning
            WHERE id_toko = ANY($1::int[])
            ORDER BY created_at DESC, id DESC
            `,
            [toArrayParam(tokoIds)]
        );

        const pengawasanPdfPendingResult = await client.query<DashboardPengawasanPdfPendingRow>(
            `
            SELECT id, nomor_ulok, lingkup_pekerjaan, h_day, tanggal_pengawasan,
                   link_pdf_pengawasan, source_sheet, source_row, status, created_at
            FROM pengawasan_pdf_migration_pending
            WHERE status = 'PENDING'
              AND UPPER(nomor_ulok) = ANY($1::text[])
            ORDER BY created_at DESC, id DESC
            `,
            [[...new Set(tokoResult.rows.map((row) => normalizeDashboardUlok(row.nomor_ulok)).filter(Boolean))]]
        );

        const rabItemsByRabId = new Map<number, DashboardRabItemRow[]>();
        for (const item of rabItemResult.rows) {
            pushMapArray(rabItemsByRabId, item.id_rab, item);
        }

        const rabByTokoId = new Map<number, Array<DashboardRabRow & { items: DashboardRabItemRow[] }>>();
        for (const row of rabResult.rows) {
            const items = rabItemsByRabId.get(row.id) ?? [];
            pushMapArray(rabByTokoId, row.id_toko, { ...row, items });
        }

        const kategoriByGanttId = new Map<number, DashboardKategoriGanttRow[]>();
        for (const row of kategoriResult.rows) {
            pushMapArray(kategoriByGanttId, row.id_gantt, row);
        }

        const dayByGanttId = new Map<number, DashboardDayGanttRow[]>();
        for (const row of dayResult.rows) {
            pushMapArray(dayByGanttId, row.id_gantt, row);
        }

        const pengawasanGanttByGanttId = new Map<number, DashboardPengawasanGanttRow[]>();
        for (const row of pengawasanGanttResult.rows) {
            pushMapArray(pengawasanGanttByGanttId, row.id_gantt, row);
        }

        const pengawasanByGanttId = new Map<number, DashboardPengawasanRow[]>();
        for (const row of pengawasanResult.rows) {
            pushMapArray(pengawasanByGanttId, row.id_gantt, row);
        }

        const dependencyByGanttId = new Map<number, DashboardDependencyGanttRow[]>();
        for (const row of dependencyResult.rows) {
            pushMapArray(dependencyByGanttId, row.id_gantt, row);
        }

        const berkasByPengawasanGanttId = new Map<number, DashboardBerkasPengawasanRow[]>();
        for (const row of berkasPengawasanResult.rows) {
            pushMapArray(berkasByPengawasanGanttId, row.id_pengawasan_gantt, row);
        }

        const ganttByTokoId = new Map<number, Array<DashboardGanttRow & {
            kategori_pekerjaan: DashboardKategoriGanttRow[];
            day_items: DashboardDayGanttRow[];
            pengawasan_gantt: DashboardPengawasanGanttRow[];
            pengawasan: DashboardPengawasanRow[];
            dependencies: DashboardDependencyGanttRow[];
            berkas_pengawasan: DashboardBerkasPengawasanRow[];
        }>>();

        for (const row of ganttResult.rows) {
            const pengawasanGantt = pengawasanGanttByGanttId.get(row.id) ?? [];
            const berkasPengawasan = pengawasanGantt.flatMap((item) => berkasByPengawasanGanttId.get(item.id) ?? []);
            const mapped = {
                ...row,
                kategori_pekerjaan: kategoriByGanttId.get(row.id) ?? [],
                day_items: dayByGanttId.get(row.id) ?? [],
                pengawasan_gantt: pengawasanGantt,
                pengawasan: pengawasanByGanttId.get(row.id) ?? [],
                dependencies: dependencyByGanttId.get(row.id) ?? [],
                berkas_pengawasan: berkasPengawasan
            };
            pushMapArray(ganttByTokoId, row.id_toko, mapped);
        }

        const spkLogsBySpkId = new Map<number, DashboardSpkApprovalLogRow[]>();
        for (const row of spkLogResult.rows) {
            pushMapArray(spkLogsBySpkId, row.pengajuan_spk_id, row);
        }

        const pertambahanBySpkId = new Map<number, DashboardPertambahanSpkRow[]>();
        for (const row of pertambahanResult.rows) {
            pushMapArray(pertambahanBySpkId, row.id_spk, row);
        }

        const spkByTokoId = new Map<number, Array<DashboardSpkRow & {
            approval_logs: DashboardSpkApprovalLogRow[];
            pertambahan_spk: DashboardPertambahanSpkRow[];
        }>>();

        for (const row of spkResult.rows) {
            const mapped = {
                ...row,
                approval_logs: spkLogsBySpkId.get(row.id) ?? [],
                pertambahan_spk: pertambahanBySpkId.get(row.id) ?? []
            };
            const explicitTokoId = Number(row.id_toko);
            const targetTokoIds = tokoIds.includes(explicitTokoId)
                ? [explicitTokoId]
                : (tokoIdsByScopeKey.get(dashboardScopeKey(row.nomor_ulok, row.lingkup_pekerjaan)) ?? []);
            for (const targetTokoId of targetTokoIds) {
                pushMapArray(spkByTokoId, targetTokoId, mapped);
            }
        }

        const picByTokoId = new Map<number, DashboardPicPengawasanRow>();
        for (const row of picResult.rows) {
            if (!picByTokoId.has(row.id_toko)) {
                picByTokoId.set(row.id_toko, row);
            }
        }

        const instruksiItemsById = new Map<number, DashboardInstruksiLapanganItemRow[]>();
        for (const row of instruksiItemResult.rows) {
            pushMapArray(instruksiItemsById, row.id_instruksi_lapangan, row);
        }

        const instruksiByTokoId = new Map<number, Array<DashboardInstruksiLapanganRow & { items: DashboardInstruksiLapanganItemRow[] }>>();
        for (const row of instruksiResult.rows) {
            const mapped = {
                ...row,
                items: instruksiItemsById.get(row.id) ?? []
            };
            pushMapArray(instruksiByTokoId, row.id_toko, mapped);
        }

        const opnameItemsByFinalId = new Map<number, DashboardOpnameItemRow[]>();
        for (const row of opnameItemResult.rows) {
            pushMapArray(opnameItemsByFinalId, row.id_opname_final, row);
        }

        const opnameFinalByTokoId = new Map<number, Array<DashboardOpnameFinalRow & { items: DashboardOpnameItemRow[] }>>();
        for (const row of opnameFinalResult.rows) {
            const mapped = {
                ...row,
                items: opnameItemsByFinalId.get(row.id) ?? []
            };
            pushMapArray(opnameFinalByTokoId, row.id_toko, mapped);
        }

        const berkasSerahByTokoId = new Map<number, DashboardBerkasSerahTerimaRow[]>();
        for (const row of berkasSerahTerimaResult.rows) {
            pushMapArray(berkasSerahByTokoId, row.id_toko, row);
        }

        const ppByTokoId = new Map<number, DashboardProjectPlanningRow[]>();
        for (const row of projectPlanningResult.rows) {
            if (row.id_toko != null) pushMapArray(ppByTokoId, row.id_toko, row);
        }

        const pendingPdfByUlok = new Map<string, DashboardPengawasanPdfPendingRow[]>();
        for (const row of pengawasanPdfPendingResult.rows) {
            const key = normalizeDashboardUlok(row.nomor_ulok);
            const items = pendingPdfByUlok.get(key) ?? [];
            items.push(row);
            pendingPdfByUlok.set(key, items);
        }

        return tokoResult.rows.map((toko) => ({
            toko,
            rab: rabByTokoId.get(toko.id) ?? [],
            gantt: ganttByTokoId.get(toko.id) ?? [],
            spk: spkByTokoId.get(toko.id) ?? [],
            pic_pengawasan: picByTokoId.get(toko.id) ?? null,
            pengawasan_pdf_pending: pendingPdfByUlok.get(normalizeDashboardUlok(toko.nomor_ulok)) ?? [],
            instruksi_lapangan: instruksiByTokoId.get(toko.id) ?? [],
            opname_final: opnameFinalByTokoId.get(toko.id) ?? [],
            berkas_serah_terima: berkasSerahByTokoId.get(toko.id) ?? [],
            project_planning: ppByTokoId.get(toko.id) ?? []
        }));
        } finally {
            client.release();
        }
    },

    async findDokumentasiBangunanForExport(): Promise<DashboardDokumentasiBangunanRow[]> {
        const result = await pool.query<DashboardDokumentasiBangunanRow>(
            `
            SELECT nomor_ulok, nama_toko, kode_toko, cabang, tanggal_go, created_at
            FROM dokumentasi_bangunan
            WHERE tanggal_go IS NOT NULL
              AND TRIM(COALESCE(tanggal_go, '')) <> ''
            ORDER BY created_at DESC, id DESC
            `
        );

        return result.rows;
    }
};
