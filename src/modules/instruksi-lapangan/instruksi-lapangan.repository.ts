import { pool } from "../../db/pool";
import { getBranchScopeCandidates } from "../../common/branch-scope";
import { calculateEffectiveStDate, toIsoDateString } from "../../common/national-holidays";
import type { InstruksiLapanganItemInput, SubmitInstruksiLapanganInput } from "./instruksi-lapangan.schema";

export interface InstruksiLapanganRow {
    id: number;
    id_toko: number;
    status: string;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    link_lampiran: string | null;
    email_pembuat: string;
    tanggal_mulai: string | null;
    tanggal_selesai: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    pemberi_persetujuan_kontraktor: string | null;
    waktu_persetujuan_kontraktor: string | null;
    catatan_persetujuan_koordinator: string | null;
    catatan_persetujuan_manager: string | null;
    catatan_persetujuan_kontraktor: string | null;
    alasan_penolakan: string | null;
    catatan_penolakan: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string;
}

export interface InstruksiLapanganItemRow {
    id: number;
    id_instruksi_lapangan: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
    total_material: number | string;
    total_upah: number | string;
    total_harga: number | string;
    catatan: string | null;
    il_tanggal_mulai?: string | null;
    il_tanggal_selesai?: string | null;
    il_created_at?: string | null;
}

export interface TokoRow {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string;
    kode_toko: string;
    proyek: string;
    cabang: string;
    alamat: string;
    nama_kontraktor: string;
}

export interface InstruksiLapanganDateBoundsRow {
    spk_start_date: string | null;
    spk_base_end_date: string | null;
    spk_effective_end_date: string | null;
    spk_extension_until: string | null;
    denda_until_date: string | null;
    st_target_date: string | null;
    max_allowed_date: string | null;
}

const parseDateOnly = (value?: string | null): Date | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const parsed = raw.includes("/")
        ? (() => {
            const [dd, mm, yyyy] = raw.split("/");
            return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        })()
        : new Date(raw.split("T")[0] + "T00:00:00");
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const maxIsoDate = (...values: Array<string | null | undefined>): string | null => {
    const dates = values.map(value => String(value ?? "").slice(0, 10)).filter(Boolean).sort();
    return dates.at(-1) ?? null;
};

export const instruksiLapanganRepository = {
    toCurrency(value: number) {
        return Number(value.toFixed(2));
    },

    async insertWithItems(
        input: SubmitInstruksiLapanganInput,
        idToko: number,
        lampiranPath?: string
    ) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Hitung grand total
            let grandTotal = 0;
            const items = input.detail_items.map(item => {
                const totalMaterial = this.toCurrency(item.harga_material * item.volume);
                const totalUpah = this.toCurrency(item.harga_upah * item.volume);
                const totalHarga = this.toCurrency(totalMaterial + totalUpah);
                grandTotal += totalHarga;
                return {
                    ...item,
                    totalMaterial,
                    totalUpah,
                    totalHarga,
                    catatan: item.catatan || null
                };
            });

            const insertHeaderRes = await client.query(`
                INSERT INTO instruksi_lapangan (
                    id_toko, status, email_pembuat, link_lampiran, grand_total,
                    tanggal_mulai, tanggal_selesai
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
            `, [
                idToko,
                "Menunggu Persetujuan Koordinator",
                input.email_pembuat,
                lampiranPath || null,
                grandTotal.toString(),
                input.tanggal_mulai,
                input.tanggal_selesai
            ]);

            const header = insertHeaderRes.rows[0];

            for (const item of items) {
                await client.query(`
                    INSERT INTO instruksi_lapangan_item (
                        id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan,
                        satuan, volume, harga_material, harga_upah,
                        total_material, total_upah, total_harga, catatan
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    header.id, item.kategori_pekerjaan, item.jenis_pekerjaan,
                    item.satuan, item.volume, item.harga_material, item.harga_upah,
                    item.totalMaterial, item.totalUpah, item.totalHarga, item.catatan
                ]);
            }

            await client.query("COMMIT");
            return header.id;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    async getById(id: string | number) {
        const res = await pool.query(`
            SELECT il.*, t.nomor_ulok, t.nama_toko, t.cabang, t.lingkup_pekerjaan, t.proyek
            FROM instruksi_lapangan il
            JOIN toko t ON il.id_toko = t.id
            WHERE il.id = $1
        `, [id]);
        return res.rows[0] || null;
    },

    async getLatestByTokoId(idToko: number): Promise<InstruksiLapanganRow | null> {
        const res = await pool.query(
            "SELECT * FROM instruksi_lapangan WHERE id_toko = $1 ORDER BY id DESC LIMIT 1",
            [idToko]
        );
        return res.rows[0] || null;
    },

    async getApprovedByTokoId(idToko: number): Promise<InstruksiLapanganRow[]> {
        const res = await pool.query(
            "SELECT * FROM instruksi_lapangan WHERE id_toko = $1 AND status IN ('Disetujui', 'Approved') ORDER BY created_at ASC, id ASC",
            [idToko]
        );
        return res.rows;
    },

    async replaceRejectedWithDetails(
        idIL: number,
        input: SubmitInstruksiLapanganInput,
        lampiranPath?: string
    ) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Delete old items
            await client.query("DELETE FROM instruksi_lapangan_item WHERE id_instruksi_lapangan = $1", [idIL]);

            let grandTotal = 0;
            const items = input.detail_items.map(item => {
                const totalMaterial = this.toCurrency(item.harga_material * item.volume);
                const totalUpah = this.toCurrency(item.harga_upah * item.volume);
                const totalHarga = this.toCurrency(totalMaterial + totalUpah);
                grandTotal += totalHarga;
                return { ...item, totalMaterial, totalUpah, totalHarga, catatan: item.catatan || null };
            });

            // Update header
            const params: any[] = [idIL, grandTotal.toString(), input.tanggal_mulai, input.tanggal_selesai];
            const updateFields = [
                "status = 'Menunggu Persetujuan Koordinator'",
                "alasan_penolakan = NULL",
                "pemberi_persetujuan_koordinator = NULL",
                "waktu_persetujuan_koordinator = NULL",
                "pemberi_persetujuan_manager = NULL",
                "waktu_persetujuan_manager = NULL",
                "pemberi_persetujuan_kontraktor = NULL",
                "waktu_persetujuan_kontraktor = NULL",
                "created_at = timezone('Asia/Jakarta', now())",
                "grand_total = $2",
                "tanggal_mulai = $3",
                "tanggal_selesai = $4"
            ];

            if (lampiranPath !== undefined) {
                params.push(lampiranPath || null);
                updateFields.push(`link_lampiran = $${params.length}`);
            }

            await client.query(`
                UPDATE instruksi_lapangan
                SET ${updateFields.join(", ")}
                WHERE id = $1
            `, params);

            for (const item of items) {
                await client.query(`
                    INSERT INTO instruksi_lapangan_item (
                        id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan,
                        satuan, volume, harga_material, harga_upah,
                        total_material, total_upah, total_harga, catatan
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    idIL, item.kategori_pekerjaan, item.jenis_pekerjaan,
                    item.satuan, item.volume, item.harga_material, item.harga_upah,
                    item.totalMaterial, item.totalUpah, item.totalHarga, item.catatan
                ]);
            }

            await client.query("COMMIT");
            return idIL;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    async getHeaderAndToko(id: string | number): Promise<{ instruksiLapangan: InstruksiLapanganRow, toko: TokoRow } | null> {
        const resIL = await pool.query(`
            SELECT * FROM instruksi_lapangan WHERE id = $1
        `, [id]);
        
        if (resIL.rows.length === 0) return null;
        
        const il = resIL.rows[0];
        
        const resToko = await pool.query(`
            SELECT * FROM toko WHERE id = $1
        `, [il.id_toko]);
        
        return {
            instruksiLapangan: il,
            toko: resToko.rows[0]
        };
    },

    async getItems(idIL: string | number): Promise<InstruksiLapanganItemRow[]> {
        const res = await pool.query(`
            SELECT * FROM instruksi_lapangan_item WHERE id_instruksi_lapangan = $1 ORDER BY id ASC
        `, [idIL]);
        return res.rows;
    },

    async getApprovedItemsByTokoId(idToko: number): Promise<InstruksiLapanganItemRow[]> {
        const res = await pool.query(`
            SELECT
                ili.*,
                il.tanggal_mulai AS il_tanggal_mulai,
                il.tanggal_selesai AS il_tanggal_selesai,
                il.created_at AS il_created_at
            FROM instruksi_lapangan_item ili
            JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
            WHERE il.id_toko = $1
              AND il.status IN ('Disetujui', 'Approved')
            ORDER BY il.created_at ASC, il.id ASC, ili.id ASC
        `, [idToko]);
        return res.rows;
    },

    async getTokoById(idToko: number): Promise<TokoRow | null> {
        const res = await pool.query(`
            SELECT * FROM toko WHERE id = $1
        `, [idToko]);
        return res.rows[0] || null;
    },

    async getTokoByUlok(nomorUlok: string, lingkupPekerjaan?: string | null): Promise<TokoRow | null> {
        const params: any[] = [nomorUlok];
        let scopeCondition = "";

        if (lingkupPekerjaan) {
            params.push(lingkupPekerjaan);
            scopeCondition = "AND LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER($2)";
        }

        const res = await pool.query(`
            SELECT *
            FROM toko
            WHERE nomor_ulok = $1
            ${scopeCondition}
            ORDER BY id DESC
            LIMIT 1
        `, params);
        return res.rows[0] || null;
    },

    async getDateBoundsByTokoId(idToko: number): Promise<InstruksiLapanganDateBoundsRow | null> {
        const res = await pool.query<{
            spk_start_date: string | null;
            spk_base_end_date: string | null;
            spk_effective_end_date: string | null;
            spk_extension_until: string | null;
            denda_until_date: string | null;
        }>(`
            SELECT
                p.waktu_mulai::date::text AS spk_start_date,
                p.waktu_selesai::date::text AS spk_base_end_date,
                COALESCE(psp.approved_until, p.waktu_selesai::date)::text AS spk_effective_end_date,
                psp.approved_until::text AS spk_extension_until,
                ofd.denda_until::text AS denda_until_date
            FROM pengajuan_spk p
            JOIN toko t ON t.id = p.id_toko
            LEFT JOIN LATERAL (
                SELECT MAX(parsed_extension_date) AS approved_until
                FROM (
                    SELECT
                        CASE
                            WHEN parsed.raw_value ~ '^\d{4}-\d{2}-\d{2}'
                             AND to_char(to_date(LEFT(parsed.raw_value, 10), 'YYYY-MM-DD'), 'YYYY-MM-DD') = LEFT(parsed.raw_value, 10)
                                THEN to_date(LEFT(parsed.raw_value, 10), 'YYYY-MM-DD')
                            WHEN parsed.raw_value ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                             AND (to_char(to_date(parsed.raw_value, 'DD/MM/YYYY'), 'FMDD/FMMM/YYYY') = parsed.raw_value
                              OR to_char(to_date(parsed.raw_value, 'DD/MM/YYYY'), 'DD/MM/YYYY') = parsed.raw_value)
                                THEN to_date(parsed.raw_value, 'DD/MM/YYYY')
                            ELSE NULL
                        END AS parsed_extension_date
                    FROM pengajuan_spk ps_scope
                    JOIN pertambahan_spk pt ON pt.id_spk = ps_scope.id
                    CROSS JOIN LATERAL (
                        SELECT TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) AS raw_value
                    ) parsed
                    WHERE ps_scope.nomor_ulok = p.nomor_ulok
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ) safe_extension_dates
            ) psp ON true
            LEFT JOIN LATERAL (
                SELECT MAX(parsed_denda_date) AS denda_until
                FROM (
                    SELECT
                        CASE
                            WHEN parsed.raw_value ~ '^\d{4}-\d{2}-\d{2}'
                             AND to_char(to_date(LEFT(parsed.raw_value, 10), 'YYYY-MM-DD'), 'YYYY-MM-DD') = LEFT(parsed.raw_value, 10)
                                THEN to_date(LEFT(parsed.raw_value, 10), 'YYYY-MM-DD')
                            WHEN parsed.raw_value ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                             AND (to_char(to_date(parsed.raw_value, 'DD/MM/YYYY'), 'FMDD/FMMM/YYYY') = parsed.raw_value
                              OR to_char(to_date(parsed.raw_value, 'DD/MM/YYYY'), 'DD/MM/YYYY') = parsed.raw_value)
                                THEN to_date(parsed.raw_value, 'DD/MM/YYYY')
                            ELSE NULL
                        END AS parsed_denda_date
                    FROM opname_final ofn
                    CROSS JOIN LATERAL (
                        VALUES
                            (TRIM(COALESCE(ofn.tanggal_serah_terima_denda::text, ''))),
                            (TRIM(COALESCE(ofn.tanggal_akhir_spk_denda::text, '')))
                    ) parsed(raw_value)
                    WHERE ofn.id_toko = p.id_toko
                      AND (
                        COALESCE(ofn.hari_denda, 0) > 0
                        OR COALESCE(ofn.nilai_denda, 0) > 0
                        OR ofn.tanggal_serah_terima_denda IS NOT NULL
                        OR ofn.tanggal_akhir_spk_denda IS NOT NULL
                      )
                ) safe_denda_dates
            ) ofd ON true
            WHERE p.id_toko = $1
              AND UPPER(TRIM(COALESCE(p.status, ''))) IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI', 'APPROVED', 'DISETUJUI', 'AKTIF')
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 1
        `, [idToko]);

        const row = res.rows[0];
        if (!row) return null;

        const stTargetDate = parseDateOnly(row.spk_effective_end_date);
        const stTarget = stTargetDate ? toIsoDateString(calculateEffectiveStDate(stTargetDate).effectiveStDate) : null;

        return {
            ...row,
            st_target_date: stTarget,
            max_allowed_date: maxIsoDate(row.spk_effective_end_date, row.spk_extension_until, row.denda_until_date, stTarget)
        };
    },

    async updatePdfLinks(
        id: number | string,
        updates: { pdfGabungan: string; pdfNonSbo: string; pdfRekapitulasi: string; grandTotalNonSbo: string; grandTotalFinal: string }
    ) {
        await pool.query(`
            UPDATE instruksi_lapangan
            SET link_pdf_gabungan = $1,
                link_pdf_non_sbo = $2,
                link_pdf_rekapitulasi = $3,
                grand_total_non_sbo = $4,
                grand_total_final = $5
            WHERE id = $6
        `, [
            updates.pdfGabungan, updates.pdfNonSbo, updates.pdfRekapitulasi,
            updates.grandTotalNonSbo, updates.grandTotalFinal, id
        ]);
    },

    async updateApproval(
        id: number | string,
        status: string,
        approverRole: 'koordinator' | 'manager' | 'kontraktor',
        approverEmail: string,
        alasanPenolakan?: string,
        catatanApproval?: string | null
    ) {
        const now = new Date();
        const timeField = `waktu_persetujuan_${approverRole}`;
        const emailField = `pemberi_persetujuan_${approverRole}`;
        const noteField = alasanPenolakan !== undefined ? "catatan_penolakan" : `catatan_persetujuan_${approverRole}`;

        let query = `UPDATE instruksi_lapangan SET status = $1, ${emailField} = $2, ${timeField} = $3, ${noteField} = $4`;
        const params: any[] = [status, approverEmail, now, catatanApproval?.trim() || null];

        if (alasanPenolakan !== undefined) {
            query += `, alasan_penolakan = $5 WHERE id = $6`;
            params.push(alasanPenolakan, id);
        } else {
            query += `, alasan_penolakan = NULL, catatan_penolakan = NULL WHERE id = $5`;
            params.push(id);
        }

        await pool.query(query, params);
    },

    async findMany(query: { 
        status?: string; 
        nomor_ulok?: string; 
        cabang?: string; 
        cabang_array?: string[]; // NEW: Accept array of branches
        email_pembuat?: string; 
        id_toko?: number;
    }) {
        const conditions: string[] = [];
        const params: any[] = [];
        let index = 1;

        let sql = `
            SELECT il.*, t.nomor_ulok, t.nama_toko, t.cabang, t.nama_kontraktor
            FROM instruksi_lapangan il
            JOIN toko t ON il.id_toko = t.id
            WHERE 1=1
        `;

        if (query.status) {
            conditions.push(`il.status = $${index++}`);
            params.push(query.status);
        }
        if (query.nomor_ulok) {
            conditions.push(`t.nomor_ulok ILIKE $${index++}`);
            params.push(`%${query.nomor_ulok}%`);
        }
        
        // NEW: Prioritize cabang_array over cabang
        if (query.cabang_array && query.cabang_array.length > 0) {
            conditions.push(`REPLACE(UPPER(TRIM(t.cabang)), '_', ' ') = ANY($${index++}::text[])`);
            const normalizedBranches = query.cabang_array.map(b => b.trim().replace(/_+/g, ' ').replace(/\s+/g, ' ').toUpperCase());
            params.push(normalizedBranches);
        } else if (query.cabang) {
            conditions.push(`REPLACE(UPPER(TRIM(t.cabang)), '_', ' ') = ANY($${index++}::text[])`);
            params.push(getBranchScopeCandidates(query.cabang).map(b => b.replace(/_+/g, ' ').replace(/\s+/g, ' ').toUpperCase()));
        }
        
        if (query.email_pembuat) {
            conditions.push(`il.email_pembuat ILIKE $${index++}`);
            params.push(`%${query.email_pembuat}%`);
        }
        if (query.id_toko) {
            conditions.push(`il.id_toko = $${index++}`);
            params.push(query.id_toko);
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        sql += " ORDER BY il.created_at DESC";

        const res = await pool.query(sql, params);
        return res.rows;
    },

    /**
     * Setelah IL disetujui Manager, injeksi otomatis kategori IL yang belum ada
     * ke kategori_pekerjaan_gantt + day_gantt_chart.
     *
     * Referensi hari ke-1 = pengajuan_spk.waktu_mulai
     * h_awal  = (il.tanggal_mulai  - spk.waktu_mulai) + 1
     * h_akhir = (il.tanggal_selesai - spk.waktu_mulai) + 1
     */
    async injectApprovedIlToGantt(idIL: number | string): Promise<{ injected: number; skipped: number }> {
        const client = await pool.connect();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        try {
            await client.query("BEGIN");

            // 1. Ambil data IL (header) + toko + gantt_chart + SPK
            const dataRes = await client.query<{
                il_id: number;
                id_toko: number;
                tanggal_mulai: Date | null;
                tanggal_selesai: Date | null;
                gantt_id: number | null;
                spk_mulai: Date | null;
            }>(`
                SELECT
                    il.id          AS il_id,
                    il.id_toko,
                    il.tanggal_mulai,
                    il.tanggal_selesai,
                    g.id           AS gantt_id,
                    spk.waktu_mulai AS spk_mulai
                FROM instruksi_lapangan il
                JOIN toko t ON t.id = il.id_toko
                LEFT JOIN LATERAL (
                    SELECT id FROM gantt_chart
                    WHERE id_toko = t.id
                    ORDER BY id DESC LIMIT 1
                ) g ON true
                LEFT JOIN LATERAL (
                    SELECT waktu_mulai FROM pengajuan_spk
                    WHERE id_toko = t.id
                    ORDER BY id DESC LIMIT 1
                ) spk ON true
                WHERE il.id = $1
            `, [idIL]);

            if (dataRes.rows.length === 0) {
                console.warn(`[IL][GANTT_INJECT] IL id=${idIL} tidak ditemukan`);
                await client.query("ROLLBACK");
                return { injected: 0, skipped: 0 };
            }

            const { id_toko, tanggal_mulai, tanggal_selesai, gantt_id, spk_mulai } = dataRes.rows[0];

            if (!gantt_id) {
                console.warn(`[IL][GANTT_INJECT] Tidak ada Gantt Chart untuk id_toko=${id_toko}, skip inject.`);
                await client.query("ROLLBACK");
                return { injected: 0, skipped: 0 };
            }

            if (!tanggal_mulai || !tanggal_selesai) {
                console.warn(`[IL][GANTT_INJECT] IL id=${idIL} tidak memiliki tanggal_mulai/selesai, skip inject.`);
                await client.query("ROLLBACK");
                return { injected: 0, skipped: 0 };
            }

            if (!spk_mulai) {
                console.warn(`[IL][GANTT_INJECT] Tidak ada data SPK untuk id_toko=${id_toko}, skip inject.`);
                await client.query("ROLLBACK");
                return { injected: 0, skipped: 0 };
            }

            // 2. Hitung h_awal/h_akhir: referensi hari ke-1 = spk.waktu_mulai
            const toUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const spkUTC    = toUTC(new Date(spk_mulai));
            const ilStartUTC = toUTC(new Date(tanggal_mulai));
            const ilEndUTC   = toUTC(new Date(tanggal_selesai));

            const diffStart = Math.round((ilStartUTC - spkUTC) / MS_PER_DAY);
            const diffEnd   = Math.round((ilEndUTC   - spkUTC) / MS_PER_DAY);
            const hAwal  = Math.max(1, diffStart + 1);
            const hAkhir = Math.max(hAwal, diffEnd + 1);

            // 3. Ambil semua kategori unik dari item IL ini
            const itemsRes = await client.query<{ kategori_pekerjaan: string }>(`
                SELECT DISTINCT UPPER(TRIM(kategori_pekerjaan)) AS kategori_pekerjaan
                FROM instruksi_lapangan_item
                WHERE id_instruksi_lapangan = $1
                  AND kategori_pekerjaan IS NOT NULL
                  AND TRIM(kategori_pekerjaan) <> ''
            `, [idIL]);

            let injected = 0;
            let skipped  = 0;

            for (const { kategori_pekerjaan } of itemsRes.rows) {
                // 4. Cek apakah kategori sudah ada di gantt (cek hanya dengan prefix [IL], agar terpisah dari item RAB)
                const existCheck = await client.query<{ id: number; dgc_id: number | null }>(`
                    SELECT kpg.id, dgc.id AS dgc_id
                    FROM kategori_pekerjaan_gantt kpg
                    LEFT JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
                    WHERE kpg.id_gantt = $1
                      AND UPPER(TRIM(kpg.kategori_pekerjaan)) = '[IL] ' || $2
                    LIMIT 1
                `, [gantt_id, kategori_pekerjaan]);

                if (existCheck.rows.length > 0) {
                    // Kategori sudah ada — skip (tidak overwrite data yang sudah di-edit user)
                    console.log(`[IL][GANTT_INJECT] SKIP Gantt ${gantt_id} | "${kategori_pekerjaan}" sudah ada`);
                    skipped++;
                    continue;
                }

                // 5. Insert kategori baru dengan prefix [IL]
                const ilName = `[IL] ${kategori_pekerjaan}`;
                const kpgRes = await client.query<{ id: number }>(`
                    INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
                    VALUES ($1, $2) RETURNING id
                `, [gantt_id, ilName]);

                const kpgId = kpgRes.rows[0].id;

                // 6. Insert balok hari
                await client.query(`
                    INSERT INTO day_gantt_chart (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
                    VALUES ($1, $2, $3, $4, NULL, NULL)
                `, [gantt_id, kpgId, String(hAwal), String(hAkhir)]);

                console.log(`[IL][GANTT_INJECT] INSERT Gantt ${gantt_id} | "${ilName}" | h_awal=${hAwal}, h_akhir=${hAkhir}`);
                injected++;
            }

            await client.query("COMMIT");
            return { injected, skipped };

        } catch (error) {
            await client.query("ROLLBACK");
            console.error(`[IL][GANTT_INJECT] Error inject IL id=${idIL}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
};
