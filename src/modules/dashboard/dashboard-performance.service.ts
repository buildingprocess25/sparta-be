import { pool } from "../../db/pool";
import type { DashboardPerformanceDrilldownInput, DashboardPerformanceQueryInput } from "./dashboard-performance.types";

const pushParam = (params: unknown[], value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
};

const normalizeUpper = (value: unknown) => String(value ?? "").trim().toUpperCase();

const buildScopeWhere = (query: DashboardPerformanceQueryInput, alias = "t") => {
    const params: unknown[] = [];
    const where = [`COALESCE(${alias}.nomor_ulok, '') <> ''`];

    if (query.cabang && normalizeUpper(query.cabang) !== "ALL" && normalizeUpper(query.cabang) !== "SEMUA CABANG") {
        where.push(`UPPER(${alias}.cabang) = ${pushParam(params, normalizeUpper(query.cabang))}`);
    } else if (normalizeUpper(query.actor_cabang) !== "HEAD OFFICE") {
        where.push(`UPPER(${alias}.cabang) = ${pushParam(params, normalizeUpper(query.actor_cabang))}`);
    }

    if (query.search) {
        const search = `%${query.search}%`;
        where.push(`(${alias}.nomor_ulok ILIKE ${pushParam(params, search)} OR ${alias}.nama_toko ILIKE ${pushParam(params, search)})`);
    }

    if (query.job_type && normalizeUpper(query.job_type) !== "ALL") {
        where.push(`UPPER(${alias}.lingkup_pekerjaan) = ${pushParam(params, normalizeUpper(query.job_type))}`);
    }

    return { where: where.join(" AND "), params };
};

export const dashboardPerformanceService = {
    async getSummary(query: DashboardPerformanceQueryInput) {
        const scoped = buildScopeWhere(query, "t");
        const filters = [scoped.where];
        const params = [...scoped.params];

        // Ensure we handle coordinator/support filters if provided for the top-level
        if (query.coordinator && normalizeUpper(query.coordinator) !== "ALL") {
            filters.push(`EXISTS (
                SELECT 1 FROM rab rf
                WHERE rf.id_toko = t.id
                  AND UPPER(rf.pemberi_persetujuan_koordinator) = ${pushParam(params, normalizeUpper(query.coordinator))}
            )`);
        }

        if (query.support && normalizeUpper(query.support) !== "ALL") {
            filters.push(`EXISTS (
                SELECT 1 FROM pic_pengawasan pf
                WHERE pf.id_toko = t.id
                  AND UPPER(pf.plc_building_support) = ${pushParam(params, normalizeUpper(query.support))}
            )`);
        }

        const sql = `
            WITH latest_rab AS (
                SELECT DISTINCT ON (id_toko)
                    id, id_toko, status, grand_total_final, luas_bangunan, created_at,
                    waktu_persetujuan_koordinator, waktu_persetujuan_manager, waktu_persetujuan_direktur,
                    pemberi_persetujuan_koordinator
                FROM rab
                WHERE UPPER(COALESCE(status, '')) IN ('DISETUJUI', 'APPROVED')
                ORDER BY id_toko, COALESCE(waktu_persetujuan_direktur::text, waktu_persetujuan_manager::text, waktu_persetujuan_koordinator::text, created_at::text) DESC NULLS LAST, id DESC
            ),
            valid_spk AS (
                SELECT DISTINCT ON (id_toko)
                    ps.id, ps.id_toko, ps.status, ps.durasi, ps.waktu_mulai, ps.waktu_selesai,
                    (
                        SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(COALESCE(pt.status_persetujuan, '')) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ) AS pertambahan_akhir_setelah_perpanjangan
                FROM pengajuan_spk ps
                WHERE UPPER(COALESCE(ps.status, '')) IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI', 'APPROVED', 'DISETUJUI', 'AKTIF')
                ORDER BY id_toko, COALESCE(waktu_selesai::text, waktu_mulai::text, created_at::text) DESC NULLS LAST, id DESC
            ),
            latest_opname AS (
                SELECT DISTINCT ON (id_toko)
                    id, id_toko, status_opname_final, created_at, grand_total_final, grand_total_opname, grand_total_rab,
                    tanggal_akhir_spk_denda, tanggal_serah_terima_denda, hari_denda, nilai_denda,
                    waktu_persetujuan_koordinator, waktu_persetujuan_manager, waktu_persetujuan_direktur
                FROM opname_final
                ORDER BY id_toko,
                    CASE WHEN UPPER(COALESCE(status_opname_final, '')) LIKE '%SETUJU%' THEN 0 ELSE 1 END,
                    COALESCE(waktu_persetujuan_direktur::text, created_at::text) DESC NULLS LAST,
                    id DESC
            ),
            latest_st AS (
                SELECT DISTINCT ON (id_toko)
                    id_toko, created_at, link_pdf
                FROM berkas_serah_terima
                WHERE COALESCE(link_pdf, '') <> ''
                ORDER BY id_toko, created_at DESC NULLS LAST, id DESC
            )
            SELECT
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                r.grand_total_final AS rab_grand_total,
                r.luas_bangunan AS luas_bangunan,
                r.created_at AS rab_created_at,
                r.waktu_persetujuan_koordinator AS rab_waktu_koordinator,
                r.waktu_persetujuan_manager AS rab_waktu_manager,
                r.waktu_persetujuan_direktur AS rab_waktu_direktur,
                s.durasi AS spk_durasi,
                s.pertambahan_akhir_setelah_perpanjangan,
                s.waktu_selesai AS spk_waktu_selesai,
                o.nilai_denda AS opname_nilai_denda,
                o.grand_total_opname,
                o.grand_total_rab AS opname_grand_total_rab,
                o.created_at AS opname_created_at,
                st.created_at AS st_created_at,
                km.tanggal_notaris_start,
                km.tanggal_notaris_end,
                km.persentase_temuan,
                km.deviasi_pe,
                o.waktu_persetujuan_koordinator AS opname_waktu_koordinator,
                o.waktu_persetujuan_manager AS opname_waktu_manager,
                o.waktu_persetujuan_direktur AS opname_waktu_direktur
            FROM toko t
            LEFT JOIN latest_rab r ON r.id_toko = t.id
            LEFT JOIN valid_spk s ON s.id_toko = t.id
            LEFT JOIN latest_opname o ON o.id_toko = t.id
            LEFT JOIN latest_st st ON st.id_toko = t.id
            LEFT JOIN toko_kpi_metrics km ON km.id_toko = t.id
            WHERE ${filters.join(" AND ")}
        `;

        const result = await pool.query(sql, params);
        const rows = result.rows;

        // Perform JS calculations
        let costSum = 0; let costCount = 0;
        let jhkSum = 0; let jhkCount = 0;
        let dendaSum = 0; let dendaCount = 0;
        
        let ktAmountSum = 0; let ktCount = 0;
        let kkAmountSum = 0; let kkCount = 0;
        
        let stDelaySum = 0; let stDelayCount = 0;
        let ktkDelaySum = 0; let ktkDelayCount = 0;

        let slaCoordSum = 0; let slaCoordCount = 0;
        let slaManagerSum = 0; let slaManagerCount = 0;
        let slaBmSum = 0; let slaBmCount = 0;

        for (const row of rows) {
            // Cost/m2
            const cost = parseFloat(row.rab_grand_total || '0');
            const luas = parseFloat(row.luas_bangunan || '0');
            if (cost > 0 && luas > 0) {
                costSum += (cost / luas);
                costCount++;
            }

            // JHK (Durasi SPK)
            if (row.spk_durasi) {
                jhkSum += parseInt(row.spk_durasi, 10);
                jhkCount++;
            }

            // Denda
            const denda = parseFloat(row.opname_nilai_denda || '0');
            if (denda > 0) {
                dendaSum += denda;
                dendaCount++;
            }

            // Kerja Tambah / Kurang (Opname - RAB)
            const opnameTotal = parseFloat(row.grand_total_opname || '0');
            const rabTotal = parseFloat(row.opname_grand_total_rab || '0');
            if (opnameTotal > 0 && rabTotal > 0) {
                const diff = opnameTotal - rabTotal;
                if (diff > 0) {
                    ktAmountSum += diff;
                    ktCount++;
                } else if (diff < 0) {
                    kkAmountSum += Math.abs(diff);
                    kkCount++;
                }
            }

            // Ketepatan ST (ST Date - SPK End Date)
            if (row.st_created_at && (row.pertambahan_akhir_setelah_perpanjangan || row.spk_waktu_selesai)) {
                const spkEnd = new Date(row.pertambahan_akhir_setelah_perpanjangan || row.spk_waktu_selesai);
                const stDate = new Date(row.st_created_at);
                const diffTime = stDate.getTime() - spkEnd.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1; // + 1 day tolerance? 
                stDelaySum += diffDays;
                stDelayCount++;
            }

            // SLA KTK (Opname Date - ST Date)
            if (row.opname_created_at && row.st_created_at) {
                const opDate = new Date(row.opname_created_at);
                const stDate = new Date(row.st_created_at);
                const diffDays = Math.ceil((opDate.getTime() - stDate.getTime()) / (1000 * 60 * 60 * 24));
                ktkDelaySum += diffDays;
                ktkDelayCount++;
            }

            // SLA Approvals (We use RAB as representative for the summary card)
            if (row.rab_created_at && row.rab_waktu_koordinator) {
                slaCoordSum += (new Date(row.rab_waktu_koordinator).getTime() - new Date(row.rab_created_at).getTime()) / 86400000;
                slaCoordCount++;
            }
            if (row.rab_waktu_koordinator && row.rab_waktu_manager) {
                slaManagerSum += (new Date(row.rab_waktu_manager).getTime() - new Date(row.rab_waktu_koordinator).getTime()) / 86400000;
                slaManagerCount++;
            }
            if (row.rab_waktu_manager && row.rab_waktu_direktur) {
                slaBmSum += (new Date(row.rab_waktu_direktur).getTime() - new Date(row.rab_waktu_manager).getTime()) / 86400000;
                slaBmCount++;
            }
        }

        return {
            avg_cost_m2: costCount > 0 ? costSum / costCount : 0,
            avg_jhk: jhkCount > 0 ? jhkSum / jhkCount : 0,
            avg_denda: dendaCount > 0 ? dendaSum / dendaCount : 0,
            avg_kerja_tambah: ktCount > 0 ? ktAmountSum / ktCount : 0,
            avg_kerja_kurang: kkCount > 0 ? kkAmountSum / kkCount : 0,
            avg_ketepatan_st: stDelayCount > 0 ? stDelaySum / stDelayCount : 0,
            avg_sla_ktk: ktkDelayCount > 0 ? ktkDelaySum / ktkDelayCount : 0,
            avg_sla_coord: slaCoordCount > 0 ? slaCoordSum / slaCoordCount : 0,
            avg_sla_manager: slaManagerCount > 0 ? slaManagerSum / slaManagerCount : 0,
            avg_sla_bm: slaBmCount > 0 ? slaBmSum / slaBmCount : 0,
            total_ulok: rows.length
        };
    },

    async getDrilldown(query: DashboardPerformanceDrilldownInput) {
        const scoped = buildScopeWhere(query, "t");
        const filters = [scoped.where];
        const params = [...scoped.params];

        // Specific filters based on flow
        if (query.person_name && query.person_name !== "SEMUA PERSONIL") {
            if (query.person_role === "coord") {
                filters.push(`EXISTS (
                    SELECT 1 FROM rab rf
                    WHERE rf.id_toko = t.id
                      AND UPPER(rf.pemberi_persetujuan_koordinator) = ${pushParam(params, normalizeUpper(query.person_name))}
                )`);
            } else if (query.person_role === "support") {
                filters.push(`EXISTS (
                    SELECT 1 FROM pic_pengawasan pf
                    WHERE pf.id_toko = t.id
                      AND UPPER(pf.plc_building_support) = ${pushParam(params, normalizeUpper(query.person_name))}
                )`);
            }
        }

        // Add filter based on card_type so drilldown isn't identical
        if (query.card_type === "cost_m2") {
            filters.push("r.grand_total_final IS NOT NULL AND r.luas_bangunan > 0");
        } else if (query.card_type === "jhk") {
            filters.push("s.durasi IS NOT NULL");
        } else if (query.card_type === "denda") {
            filters.push("o.nilai_denda IS NOT NULL AND o.nilai_denda > 0");
        } else if (query.card_type === "kerja_tambah") {
            filters.push("o.grand_total_opname IS NOT NULL AND o.grand_total_opname > COALESCE(o.grand_total_rab, 0)");
        } else if (query.card_type === "kerja_kurang") {
            filters.push("o.grand_total_opname IS NOT NULL AND o.grand_total_opname < COALESCE(o.grand_total_rab, 0)");
        } else if (query.card_type === "ketepatan_st") {
            filters.push("st.created_at IS NOT NULL AND s.waktu_selesai IS NOT NULL AND st.created_at > (COALESCE(s.pertambahan_akhir_setelah_perpanjangan, s.waktu_selesai) + INTERVAL '1 day')");
        } else if (query.card_type === "sla_ktk") {
            filters.push("o.created_at IS NOT NULL AND st.created_at IS NOT NULL");
        } else if (query.card_type === "sla") {
            if (query.sla_doc === "rab") {
                filters.push("r.id IS NOT NULL");
                if (query.sla_role === "coord") filters.push("r.waktu_persetujuan_koordinator IS NOT NULL");
                if (query.sla_role === "manager") filters.push("r.waktu_persetujuan_manager IS NOT NULL AND r.waktu_persetujuan_koordinator IS NOT NULL");
                if (query.sla_role === "bm") filters.push("r.waktu_persetujuan_direktur IS NOT NULL AND r.waktu_persetujuan_manager IS NOT NULL");
            } else if (query.sla_doc === "spk") {
                filters.push("s.id IS NOT NULL");
            } else if (query.sla_doc === "opname") {
                filters.push("o.id IS NOT NULL");
                if (query.sla_role === "coord") filters.push("o.waktu_persetujuan_koordinator IS NOT NULL");
                if (query.sla_role === "manager") filters.push("o.waktu_persetujuan_manager IS NOT NULL AND o.waktu_persetujuan_koordinator IS NOT NULL");
                if (query.sla_role === "bm") filters.push("o.waktu_persetujuan_direktur IS NOT NULL AND o.waktu_persetujuan_manager IS NOT NULL");
            }
        }

        const sql = `
            WITH latest_rab AS (
                SELECT DISTINCT ON (id_toko)
                    id, id_toko, status, grand_total_final, luas_bangunan, created_at,
                    waktu_persetujuan_koordinator, waktu_persetujuan_manager, waktu_persetujuan_direktur,
                    pemberi_persetujuan_koordinator
                FROM rab
                WHERE UPPER(COALESCE(status, '')) IN ('DISETUJUI', 'APPROVED')
                ORDER BY id_toko, COALESCE(waktu_persetujuan_direktur::text, waktu_persetujuan_manager::text, waktu_persetujuan_koordinator::text, created_at::text) DESC NULLS LAST, id DESC
            ),
            valid_spk AS (
                SELECT DISTINCT ON (id_toko)
                    ps.id, ps.id_toko, ps.status, ps.durasi, ps.waktu_mulai, ps.waktu_selesai,
                    (
                        SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(COALESCE(pt.status_persetujuan, '')) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ) AS pertambahan_akhir_setelah_perpanjangan
                FROM pengajuan_spk ps
                WHERE UPPER(COALESCE(ps.status, '')) IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI', 'APPROVED', 'DISETUJUI', 'AKTIF')
                ORDER BY id_toko, COALESCE(waktu_selesai::text, waktu_mulai::text, created_at::text) DESC NULLS LAST, id DESC
            ),
            latest_opname AS (
                SELECT DISTINCT ON (id_toko)
                    id, id_toko, status_opname_final, created_at, grand_total_final, grand_total_opname, grand_total_rab,
                    tanggal_akhir_spk_denda, tanggal_serah_terima_denda, hari_denda, nilai_denda,
                    waktu_persetujuan_koordinator, waktu_persetujuan_manager, waktu_persetujuan_direktur
                FROM opname_final
                ORDER BY id_toko,
                    CASE WHEN UPPER(COALESCE(status_opname_final, '')) LIKE '%SETUJU%' THEN 0 ELSE 1 END,
                    COALESCE(waktu_persetujuan_direktur::text, created_at::text) DESC NULLS LAST,
                    id DESC
            ),
            latest_st AS (
                SELECT DISTINCT ON (id_toko)
                    id_toko, created_at, link_pdf
                FROM berkas_serah_terima
                WHERE COALESCE(link_pdf, '') <> ''
                ORDER BY id_toko, created_at DESC NULLS LAST, id DESC
            )
            SELECT
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                r.grand_total_final AS rab_grand_total,
                r.luas_bangunan AS luas_bangunan,
                r.created_at AS rab_created_at,
                r.waktu_persetujuan_koordinator AS rab_waktu_koordinator,
                r.waktu_persetujuan_manager AS rab_waktu_manager,
                r.waktu_persetujuan_direktur AS rab_waktu_direktur,
                s.durasi AS spk_durasi,
                s.pertambahan_akhir_setelah_perpanjangan,
                s.waktu_selesai AS spk_waktu_selesai,
                o.nilai_denda AS opname_nilai_denda,
                o.grand_total_opname,
                o.grand_total_rab AS opname_grand_total_rab,
                o.created_at AS opname_created_at,
                st.created_at AS st_created_at
            FROM toko t
            LEFT JOIN latest_rab r ON r.id_toko = t.id
            LEFT JOIN valid_spk s ON s.id_toko = t.id
            LEFT JOIN latest_opname o ON o.id_toko = t.id
            LEFT JOIN latest_st st ON st.id_toko = t.id
            WHERE ${filters.join(" AND ")}
            ORDER BY t.id DESC
        `;

        const result = await pool.query(sql, params);
        
        let mapped = result.rows.map(row => {
            let value_label = "-";
            let secondary_label = "";
            let detail: any = {};

            if (query.card_type === "cost_m2") {
                const cost = parseFloat(row.rab_grand_total || '0');
                const luas = parseFloat(row.luas_bangunan || '0');
                const costM2 = luas > 0 ? (cost / luas) : 0;
                value_label = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(costM2);
                detail = { rab_approved_total: cost, luas_bangunan: luas };
            } 
            else if (query.card_type === "jhk") {
                value_label = row.spk_durasi ? `${row.spk_durasi} hari` : "-";
            }
            else if (query.card_type === "denda") {
                const denda = parseFloat(row.opname_nilai_denda || '0');
                value_label = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(denda);
            }
            else if (query.card_type === "kerja_tambah" || query.card_type === "kerja_kurang") {
                const opnameTotal = parseFloat(row.grand_total_opname || '0');
                const rabTotal = parseFloat(row.opname_grand_total_rab || '0');
                const diff = opnameTotal - rabTotal;
                
                detail = { opname_total: opnameTotal, rab_approved_total: rabTotal };
                if (query.card_type === "kerja_tambah" && diff > 0) {
                    value_label = "+ " + new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(diff);
                } else if (query.card_type === "kerja_kurang" && diff < 0) {
                    value_label = "- " + new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Math.abs(diff));
                } else {
                    value_label = "-";
                }
            }
            else if (query.card_type === "sla") {
                value_label = "Timeline";
                if (query.sla_doc === "ktk" || query.sla_doc === "opname") {
                    detail = { 
                        doc_created_date: row.opname_created_at, 
                        coord_approved_date: row.opname_waktu_koordinator,
                        bm_approved_date: row.opname_waktu_manager,
                        branch_manager_approved_date: row.opname_waktu_direktur
                    };
                } else {
                    detail = { 
                        doc_created_date: row.rab_created_at, 
                        coord_approved_date: row.rab_waktu_koordinator,
                        bm_approved_date: row.rab_waktu_manager,
                        branch_manager_approved_date: row.rab_waktu_direktur
                    };
                }
            }

            return {
                nomor_ulok: row.nomor_ulok,
                toko_id: row.toko_id,
                nama_toko: row.nama_toko,
                cabang: row.cabang,
                value_label,
                secondary_label,
                detail
            };
        });

        // Filter out empty rows if necessary depending on card
        if (query.card_type === "kerja_tambah" || query.card_type === "kerja_kurang") {
            mapped = mapped.filter(m => m.value_label !== "-");
        }

        const total = mapped.length;
        const page = query.page || 1;
        const limit = query.limit || 50;
        const paginated = mapped.slice((page - 1) * limit, page * limit);

        return {
            data: paginated,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    },

    async getTable(query: DashboardPerformanceQueryInput) {
        const scoped = buildScopeWhere(query, "t");
        const filters = [scoped.where];
        const params = [...scoped.params];

        const sql = `
            WITH latest_spk AS (
                SELECT DISTINCT ON (id_toko)
                    ps.id, ps.id_toko, ps.waktu_mulai, ps.waktu_selesai,
                    (
                        SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(COALESCE(pt.status_persetujuan, '')) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ) AS pertambahan_akhir
                FROM pengajuan_spk ps
                WHERE UPPER(COALESCE(ps.status, '')) IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI', 'APPROVED', 'DISETUJUI', 'AKTIF')
                ORDER BY id_toko, COALESCE(waktu_selesai::text, waktu_mulai::text, created_at::text) DESC NULLS LAST, id DESC
            ),
            latest_opname AS (
                SELECT DISTINCT ON (id_toko)
                    id_toko, created_at, status_opname_final
                FROM opname_final
                ORDER BY id_toko, created_at DESC NULLS LAST
            ),
            latest_st AS (
                SELECT DISTINCT ON (id_toko)
                    id_toko, created_at
                FROM berkas_serah_terima
                WHERE COALESCE(link_pdf, '') <> ''
                ORDER BY id_toko, created_at DESC NULLS LAST
            ),
            support_names AS (
                SELECT id_toko, plc_building_support 
                FROM pic_pengawasan
            )
            SELECT
                p.plc_building_support AS nama_support,
                t.id AS toko_id,
                km.tanggal_notaris_start,
                km.tanggal_notaris_end,
                km.persentase_temuan,
                km.deviasi_pe,
                s.waktu_mulai AS spk_start,
                s.pertambahan_akhir,
                s.waktu_selesai AS spk_end,
                st.created_at AS st_date,
                o.created_at AS opname_date
            FROM toko t
            JOIN support_names p ON p.id_toko = t.id
            LEFT JOIN toko_kpi_metrics km ON km.id_toko = t.id
            LEFT JOIN latest_spk s ON s.id_toko = t.id
            LEFT JOIN latest_st st ON st.id_toko = t.id
            LEFT JOIN latest_opname o ON o.id_toko = t.id
            WHERE ${filters.join(" AND ")}
              AND p.plc_building_support IS NOT NULL
              AND p.plc_building_support <> ''
        `;

        const result = await pool.query(sql, params);

        // Aggregate by Support
        const aggregated: Record<string, any> = {};

        for (const row of result.rows) {
            const name = normalizeUpper(row.nama_support);
            if (!aggregated[name]) {
                aggregated[name] = {
                    nama_support: row.nama_support,
                    jhk_notaris_end_sum: 0, jhk_notaris_end_count: 0,
                    jhk_notaris_start_sum: 0, jhk_notaris_start_count: 0,
                    temuan_sum: 0, temuan_count: 0,
                    st_delay_sum: 0, st_delay_count: 0,
                    sla_ktk_sum: 0, sla_ktk_count: 0,
                    total_ulok: 0
                };
            }

            const agg = aggregated[name];
            agg.total_ulok++;

            // JHK Notaris to End SPK
            if (row.tanggal_notaris_start && (row.pertambahan_akhir || row.spk_end)) {
                const spkEnd = new Date(row.pertambahan_akhir || row.spk_end);
                const notarisDate = new Date(row.tanggal_notaris_start);
                agg.jhk_notaris_end_sum += Math.ceil((spkEnd.getTime() - notarisDate.getTime()) / 86400000);
                agg.jhk_notaris_end_count++;
            }

            // JHK Notaris to Start SPK
            if (row.tanggal_notaris_start && row.spk_start) {
                const spkStart = new Date(row.spk_start);
                const notarisDate = new Date(row.tanggal_notaris_start);
                agg.jhk_notaris_start_sum += Math.ceil((spkStart.getTime() - notarisDate.getTime()) / 86400000);
                agg.jhk_notaris_start_count++;
            }

            // Temuan
            if (row.persentase_temuan !== null) {
                agg.temuan_sum += parseFloat(row.persentase_temuan);
                agg.temuan_count++;
            }

            // Ketepatan ST
            if (row.st_date && (row.pertambahan_akhir || row.spk_end)) {
                const spkEnd = new Date(row.pertambahan_akhir || row.spk_end);
                const stDate = new Date(row.st_date);
                agg.st_delay_sum += Math.ceil((stDate.getTime() - spkEnd.getTime()) / 86400000);
                agg.st_delay_count++;
            }

            // SLA KTK
            if (row.opname_date && row.st_date) {
                const opDate = new Date(row.opname_date);
                const stDate = new Date(row.st_date);
                agg.sla_ktk_sum += Math.ceil((opDate.getTime() - stDate.getTime()) / 86400000);
                agg.sla_ktk_count++;
            }
        }

        const formatted = Object.values(aggregated).map((agg: any) => ({
            nama_support: agg.nama_support,
            jhk_notaris_to_end_spk: agg.jhk_notaris_end_count > 0 ? (agg.jhk_notaris_end_sum / agg.jhk_notaris_end_count).toFixed(1) + " hari" : "-",
            jhk_notaris_to_start_spk: agg.jhk_notaris_start_count > 0 ? (agg.jhk_notaris_start_sum / agg.jhk_notaris_start_count).toFixed(1) + " hari" : "-",
            persentase_temuan: agg.temuan_count > 0 ? (agg.temuan_sum / agg.temuan_count).toFixed(2) + "%" : "-",
            ketepatan_st: agg.st_delay_count > 0 ? (agg.st_delay_sum / agg.st_delay_count).toFixed(1) + " hari" : "-",
            sla_ktk: agg.sla_ktk_count > 0 ? (agg.sla_ktk_sum / agg.sla_ktk_count).toFixed(1) + " hari" : "-",
            total_ulok: agg.total_ulok
        }));

        formatted.sort((a, b) => a.nama_support.localeCompare(b.nama_support));

        return formatted;
    },
};
