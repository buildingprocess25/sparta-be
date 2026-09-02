import { pool } from "../../db/pool";
import type { 
    ContractorPerformanceFilters, 
    ContractorGlobalSummary, 
    ContractorChartPoint,
    ContractorLeaderboardRow,
    ContractorRankingRow
} from "./dashboard-contractor.types";
import { branchGroupSql } from "../surat-peringatan/sp.repository";

// Helpers for period filtering
const getPeriodDateRange = (period?: string): { start: Date | null, end: Date | null } => {
    const now = new Date();
    switch (period) {
        case "THIS_MONTH":
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
            };
        case "LAST_MONTH":
            return {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
            };
        case "THIS_YEAR":
            return {
                start: new Date(now.getFullYear(), 0, 1),
                end: new Date(now.getFullYear(), 11, 31, 23, 59, 59)
            };
        case "YTD":
            return {
                start: new Date(now.getFullYear(), 0, 1),
                end: now
            };
        default:
            return { start: null, end: null };
    }
};

export const contractorPerformanceService = {
    async getSummary(filters: ContractorPerformanceFilters, allowedBranches: string[]): Promise<ContractorGlobalSummary> {
        const { cabang, job_type, period } = filters;
        
        let branchFilter = "";
        const values: any[] = [];
        
        // Allowed branches
        if (allowedBranches.length > 0) {
            const normalized = allowedBranches.map(b => b.trim().toUpperCase());
            values.push(normalized);
            branchFilter = `AND UPPER(t.cabang) = ANY($${values.length})`;
        }
        
        // Specific cabang filter
        if (cabang && cabang !== "ALL" && cabang !== "SEMUA CABANG") {
            values.push(cabang.trim().toUpperCase());
            branchFilter += ` AND UPPER(t.cabang) = $${values.length}`;
        }
        
        let jobTypeFilter = "";
        if (job_type && job_type !== "ALL") {
            values.push(job_type.toUpperCase());
            jobTypeFilter = `AND UPPER(t.jenis_pekerjaan) = $${values.length}`;
        }
        
        let periodFilterSpk = "";
        let periodFilterOpname = "";
        let periodFilterSp = "";
        
        const { start, end } = getPeriodDateRange(period);
        if (start && end) {
            values.push(start);
            values.push(end);
            periodFilterSpk = `AND ps.created_at >= $${values.length - 1} AND ps.created_at <= $${values.length}`;
            periodFilterOpname = `AND ofn.created_at >= $${values.length - 1} AND ofn.created_at <= $${values.length}`;
            periodFilterSp = `AND dka.created_at >= $${values.length - 1} AND dka.created_at <= $${values.length}`;
        }
        
        // 1. Avg Denda & Avg Keterlambatan
        const dendaQuery = `
            SELECT 
                COALESCE(AVG(ofn.nilai_denda), 0) as avg_denda,
                COALESCE(AVG(ofn.hari_denda), 0) as avg_keterlambatan
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE ofn.hari_denda > 0
            ${branchFilter}
            ${jobTypeFilter}
            ${periodFilterOpname}
        `;
        
        // 2. SP Aktif
        const spAktifQuery = `
            SELECT COUNT(DISTINCT dka.nama_kontraktor) as count
            FROM denda_keterlambatan_action dka
            JOIN toko t ON t.id = dka.id_toko
            WHERE dka.action_type = 'SP'
              AND dka.status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
              AND (dka.expires_at IS NULL OR dka.expires_at >= timezone('Asia/Jakarta', now()))
            ${branchFilter.replace(/UPPER\(t.cabang\)/g, "UPPER(dka.cabang)")}
            ${periodFilterSp}
        `;
        
        // 3. Avg Kerja Tambah & Kurang
        // Kerja Tambah = opname > spk
        // Kerja Kurang = spk > opname
        const selisihQuery = `
            WITH final_data AS (
                SELECT 
                    ofn.grand_total_opname,
                    ps.grand_total as spk_total,
                    (ofn.grand_total_opname - ps.grand_total) as selisih
                FROM opname_final ofn
                JOIN toko t ON t.id = ofn.id_toko
                JOIN pengajuan_spk ps ON ps.id_toko = t.id 
                    AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                WHERE 1=1
                ${branchFilter}
                ${jobTypeFilter}
                ${periodFilterOpname}
            )
            SELECT 
                COALESCE(AVG(selisih) FILTER (WHERE selisih > 0), 0) as avg_kerja_tambah,
                COALESCE(AVG(ABS(selisih)) FILTER (WHERE selisih < 0), 0) as avg_kerja_kurang
            FROM final_data
        `;
        
        const [dendaResult, spResult, selisihResult] = await Promise.all([
            pool.query(dendaQuery, values),
            pool.query(spAktifQuery, values),
            pool.query(selisihQuery, values)
        ]);
        
        return {
            avg_denda: Number(dendaResult.rows[0]?.avg_denda || 0),
            avg_keterlambatan: Number(dendaResult.rows[0]?.avg_keterlambatan || 0),
            sp_aktif_count: Number(spResult.rows[0]?.count || 0),
            avg_kerja_tambah: Number(selisihResult.rows[0]?.avg_kerja_tambah || 0),
            avg_kerja_kurang: Number(selisihResult.rows[0]?.avg_kerja_kurang || 0)
        };
    },
    
    async getCharts(filters: ContractorPerformanceFilters, allowedBranches: string[]): Promise<ContractorChartPoint[]> {
        const { cabang, job_type, period } = filters;
        
        let branchFilter = "";
        const values: any[] = [];
        
        if (allowedBranches.length > 0) {
            const normalized = allowedBranches.map(b => b.trim().toUpperCase());
            values.push(normalized);
            branchFilter = `AND UPPER(t.cabang) = ANY($${values.length})`;
        }
        
        if (cabang && cabang !== "ALL" && cabang !== "SEMUA CABANG") {
            values.push(cabang.trim().toUpperCase());
            branchFilter += ` AND UPPER(t.cabang) = $${values.length}`;
        }
        
        let jobTypeFilter = "";
        if (job_type && job_type !== "ALL") {
            values.push(job_type.toUpperCase());
            jobTypeFilter = `AND UPPER(t.jenis_pekerjaan) = $${values.length}`;
        }
        
        let periodFilter = "";
        const { start, end } = getPeriodDateRange(period);
        if (start && end) {
            values.push(start);
            values.push(end);
            periodFilter = `AND ps.created_at >= $${values.length - 1} AND ps.created_at <= $${values.length}`;
        } else {
            // Default 12 months if no period
            values.push(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1));
            values.push(new Date());
            periodFilter = `AND ps.created_at >= $${values.length - 1} AND ps.created_at <= $${values.length}`;
        }
        
        const query = `
            WITH monthly_data AS (
                SELECT 
                    to_char(ps.created_at, 'YYYY-MM') as month,
                    SUM(COALESCE(rab.grand_total_final, 0)) as total_penawaran,
                    SUM(COALESCE(ps.grand_total, 0)) as total_spk,
                    SUM(COALESCE(ofn.grand_total_opname, 0)) as total_opname
                FROM pengajuan_spk ps
                JOIN toko t ON t.id = ps.id_toko
                LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
                LEFT JOIN rab ON rab.id_toko = t.id AND UPPER(TRIM(COALESCE(rab.status, ''))) = 'APPROVED'
                WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                ${branchFilter}
                ${jobTypeFilter}
                ${periodFilter}
                GROUP BY to_char(ps.created_at, 'YYYY-MM')
            )
            SELECT month, total_penawaran as penawaran, total_spk as spk, total_opname as opname
            FROM monthly_data
            ORDER BY month ASC
        `;
        
        const result = await pool.query<ContractorChartPoint>(query, values);
        return result.rows;
    },
    
    async getLeaderboard(filters: ContractorPerformanceFilters, allowedBranches: string[]): Promise<ContractorLeaderboardRow[]> {
        const { cabang, job_type, period } = filters;
        
        let branchFilter = "";
        let dkaBranchFilter = "";
        const values: any[] = [];
        
        if (allowedBranches.length > 0) {
            const normalized = allowedBranches.map(b => b.trim().toUpperCase());
            values.push(normalized);
            branchFilter = `AND UPPER(t.cabang) = ANY($${values.length})`;
            dkaBranchFilter = `AND UPPER(dka.cabang) = ANY($${values.length})`;
        }
        
        if (cabang && cabang !== "ALL" && cabang !== "SEMUA CABANG") {
            values.push(cabang.trim().toUpperCase());
            branchFilter += ` AND UPPER(t.cabang) = $${values.length}`;
            dkaBranchFilter += ` AND UPPER(dka.cabang) = $${values.length}`;
        }
        
        let jobTypeFilter = "";
        if (job_type && job_type !== "ALL") {
            values.push(job_type.toUpperCase());
            jobTypeFilter = `AND UPPER(t.jenis_pekerjaan) = $${values.length}`;
        }
        
        let periodFilterSpk = "";
        let periodFilterOpname = "";
        let periodFilterSp = "";
        
        const { start, end } = getPeriodDateRange(period);
        if (start && end) {
            values.push(start);
            values.push(end);
            periodFilterSpk = `AND ps.created_at >= $${values.length - 1} AND ps.created_at <= $${values.length}`;
            periodFilterOpname = `AND ofn.created_at >= $${values.length - 1} AND ofn.created_at <= $${values.length}`;
            periodFilterSp = `AND dka.created_at >= $${values.length - 1} AND dka.created_at <= $${values.length}`;
        }
        
        const query = `
            WITH kontraktor_list AS (
                SELECT DISTINCT COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor
                FROM pengajuan_spk ps
                JOIN toko t ON t.id = ps.id_toko
                WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                ${branchFilter}
                ${jobTypeFilter}
                ${periodFilterSpk}
            ),
            sp_history AS (
                SELECT 
                    COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                    COUNT(*) as sp_count
                FROM denda_keterlambatan_action dka
                JOIN toko t ON t.id = dka.id_toko
                WHERE dka.action_type = 'SP'
                ${branchFilter}
                ${jobTypeFilter}
                ${periodFilterSp}
                GROUP BY COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), ''))
            ),
            opname_stats AS (
                SELECT 
                    COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                    COUNT(oi.id) as total_items,
                    SUM(CASE WHEN oi.desain = 'Sesuai' THEN 1 ELSE 0 END) as total_desain_sesuai,
                    SUM(CASE WHEN oi.kualitas = 'Baik' THEN 1 ELSE 0 END) as total_kualitas_baik,
                    SUM(CASE WHEN oi.spesifikasi = 'Sesuai' THEN 1 ELSE 0 END) as total_spek_sesuai
                FROM opname_final ofn
                JOIN toko t ON t.id = ofn.id_toko
                JOIN opname_item oi ON oi.id_opname_final = ofn.id
                JOIN pengajuan_spk ps ON ps.id_toko = t.id AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                WHERE 1=1
                ${branchFilter}
                ${jobTypeFilter}
                ${periodFilterOpname}
                GROUP BY COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), ''))
            ),
            raw_data AS (
                SELECT 
                    kl.nama_kontraktor,
                    COALESCE(sp.sp_count, 0)::int as history_sp_count,
                    CASE WHEN COALESCE(os.total_items, 0) > 0 THEN (os.total_desain_sesuai::numeric / os.total_items) * 100 ELSE 0 END as avg_design,
                    CASE WHEN COALESCE(os.total_items, 0) > 0 THEN (os.total_kualitas_baik::numeric / os.total_items) * 100 ELSE 0 END as avg_kualitas,
                    CASE WHEN COALESCE(os.total_items, 0) > 0 THEN (os.total_spek_sesuai::numeric / os.total_items) * 100 ELSE 0 END as avg_spek
                FROM kontraktor_list kl
                LEFT JOIN sp_history sp ON LOWER(TRIM(kl.nama_kontraktor)) = LOWER(TRIM(sp.nama_kontraktor))
                LEFT JOIN opname_stats os ON LOWER(TRIM(kl.nama_kontraktor)) = LOWER(TRIM(os.nama_kontraktor))
                WHERE kl.nama_kontraktor IS NOT NULL
            )
            SELECT 
                nama_kontraktor,
                history_sp_count,
                avg_design,
                avg_kualitas,
                avg_spek,
                ((avg_kualitas / 100 * 35) + (avg_design / 100 * 35) + (avg_spek / 100 * 30)) as avg_nilai_toko
            FROM raw_data
            ORDER BY ((avg_kualitas / 100 * 35) + (avg_design / 100 * 35) + (avg_spek / 100 * 30)) DESC
        `;
        
        const result = await pool.query(query, values);
        
        return result.rows.map(row => ({
            nama_kontraktor: row.nama_kontraktor,
            history_sp_count: Number(row.history_sp_count || 0),
            avg_design: Number(row.avg_design || 0),
            avg_kualitas: Number(row.avg_kualitas || 0),
            avg_spek: Number(row.avg_spek || 0),
            avg_nilai_toko: Number(row.avg_nilai_toko || 0)
        }));
    },

    async getDrilldownRanking(metric: string, filters: ContractorPerformanceFilters, allowedBranches: string[]): Promise<ContractorRankingRow[]> {
        const { cabang, job_type, period } = filters;
        let branchFilter = "";
        let dkaBranchFilter = "";
        const values: any[] = [];
        
        if (allowedBranches.length > 0) {
            const normalized = allowedBranches.map(b => b.trim().toUpperCase());
            values.push(normalized);
            branchFilter = `AND UPPER(t.cabang) = ANY($${values.length})`;
            dkaBranchFilter = `AND UPPER(dka.cabang) = ANY($${values.length})`;
        }
        
        if (cabang && cabang !== "ALL" && cabang !== "SEMUA CABANG") {
            values.push(cabang.trim().toUpperCase());
            branchFilter += ` AND UPPER(t.cabang) = $${values.length}`;
            dkaBranchFilter += ` AND UPPER(dka.cabang) = $${values.length}`;
        }
        
        let jobTypeFilter = "";
        if (job_type && job_type !== "ALL") {
            values.push(job_type.toUpperCase());
            jobTypeFilter = `AND UPPER(t.jenis_pekerjaan) = $${values.length}`;
        }
        
        let periodFilterOpname = "";
        let periodFilterSp = "";
        const { start, end } = getPeriodDateRange(period);
        if (start && end) {
            values.push(start);
            values.push(end);
            periodFilterOpname = `AND ofn.created_at >= $${values.length - 1} AND ofn.created_at <= $${values.length}`;
            periodFilterSp = `AND dka.created_at >= $${values.length - 1} AND dka.created_at <= $${values.length}`;
        }

        let query = "";
        
        if (metric === "avg_denda" || metric === "avg_keterlambatan") {
            const metricColumn = metric === "avg_denda" ? "nilai_denda" : "hari_denda";
            query = `
                SELECT 
                    COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                    AVG(ofn.${metricColumn}) as metric_value,
                    CASE WHEN '${metric}' = 'avg_denda' THEN 'Rupiah' ELSE 'Hari' END as metric_label
                FROM opname_final ofn
                JOIN toko t ON t.id = ofn.id_toko
                JOIN pengajuan_spk ps ON ps.id_toko = t.id AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                WHERE ofn.hari_denda > 0
                ${branchFilter} ${jobTypeFilter} ${periodFilterOpname}
                GROUP BY COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), ''))
                ORDER BY metric_value DESC
            `;
        } else if (metric === "sp_aktif") {
            query = `
                SELECT 
                    COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                    COUNT(*) as metric_value,
                    'SP Aktif' as metric_label
                FROM denda_keterlambatan_action dka
                JOIN toko t ON t.id = dka.id_toko
                WHERE dka.action_type = 'SP'
                  AND dka.status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
                  AND (dka.expires_at IS NULL OR dka.expires_at >= timezone('Asia/Jakarta', now()))
                ${dkaBranchFilter} ${periodFilterSp}
                GROUP BY COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), ''))
                ORDER BY metric_value DESC
            `;
        } else if (metric === "kerja_tambah" || metric === "kerja_kurang") {
            query = `
                WITH selisih_data AS (
                    SELECT 
                        COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                        (ofn.grand_total_opname - ps.grand_total) as selisih
                    FROM opname_final ofn
                    JOIN toko t ON t.id = ofn.id_toko
                    JOIN pengajuan_spk ps ON ps.id_toko = t.id AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                    WHERE 1=1 ${branchFilter} ${jobTypeFilter} ${periodFilterOpname}
                )
                SELECT 
                    nama_kontraktor,
                    AVG(${metric === "kerja_tambah" ? "selisih" : "ABS(selisih)"}) as metric_value,
                    'Rupiah' as metric_label
                FROM selisih_data
                WHERE ${metric === "kerja_tambah" ? "selisih > 0" : "selisih < 0"}
                GROUP BY nama_kontraktor
                ORDER BY metric_value DESC
            `;
        } else {
            return [];
        }

        const result = await pool.query(query, values);
        return result.rows.map(r => ({
            nama_kontraktor: r.nama_kontraktor,
            metric_value: Number(r.metric_value || 0),
            metric_label: r.metric_label
        }));
    },

    async getDrilldownSpHistory(kontraktor: string): Promise<any[]> {
        const query = `
            SELECT 
                dka.id_action,
                COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                dka.action_type,
                dka.created_at,
                dka.keterangan as alasan_sp,
                dka.lampiran_1_url,
                t.nama_toko,
                t.id as id_toko
            FROM denda_keterlambatan_action dka
            JOIN toko t ON t.id = dka.id_toko
            WHERE dka.action_type = 'SP'
              AND LOWER(TRIM(COALESCE(NULLIF(TRIM(dka.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')))) = LOWER(TRIM($1))
            ORDER BY dka.created_at DESC
        `;
        const result = await pool.query(query, [kontraktor]);
        return result.rows;
    },

    async getDrilldownUlok(kontraktor: string, idTokoFilter?: string): Promise<any[]> {
        // Return full list of ULOK for this contractor (mixed Sipil & ME)
        // If idTokoFilter is provided, return only that toko (for SP history flow)
        let filter = `LOWER(TRIM(COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')))) = LOWER(TRIM($1))`;
        const values: any[] = [kontraktor];
        
        if (idTokoFilter) {
            values.push(idTokoFilter);
            filter += ` AND t.id = $2`;
        }

        const query = `
            SELECT 
                ofn.id as id_opname_final,
                t.id as id_toko,
                t.nomor_toko as nomor_ulok,
                t.nama_toko,
                t.cabang,
                COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                ofn.hari_denda,
                ofn.nilai_denda,
                (ofn.grand_total_opname - ps.grand_total) as selisih_kerja,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'kualitas', oi.kualitas,
                            'desain', oi.desain,
                            'spesifikasi', oi.spesifikasi
                        )
                    ) FROM opname_item oi WHERE oi.id_opname_final = ofn.id),
                    '[]'::json
                ) as item_stats,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'lingkup_pekerjaan', ps_scope.lingkup_pekerjaan,
                            'project_type', t.jenis_pekerjaan
                        )
                    ) FROM pengajuan_spk ps_scope WHERE ps_scope.id_toko = t.id AND UPPER(TRIM(COALESCE(ps_scope.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')),
                    '[]'::json
                ) as scopes
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            WHERE ${filter}
            ORDER BY t.created_at DESC
        `;
        const result = await pool.query(query, values);
        
        // Process stats to simple string for table display
        return result.rows.map(r => {
            let k_baik = 0, d_sesuai = 0, s_sesuai = 0, total = 0;
            if (r.item_stats && r.item_stats.length > 0) {
                total = r.item_stats.length;
                r.item_stats.forEach((item: any) => {
                    if (item.kualitas === 'Baik') k_baik++;
                    if (item.desain === 'Sesuai') d_sesuai++;
                    if (item.spesifikasi === 'Sesuai') s_sesuai++;
                });
            }
            
            const kualitas = total > 0 ? (k_baik / total * 100).toFixed(0) + '%' : '0%';
            const desain = total > 0 ? (d_sesuai / total * 100).toFixed(0) + '%' : '0%';
            const spesifikasi = total > 0 ? (s_sesuai / total * 100).toFixed(0) + '%' : '0%';
            const nilai_toko = total > 0 ? ((k_baik / total * 35) + (d_sesuai / total * 35) + (s_sesuai / total * 30)).toFixed(0) : 0;
            
            return {
                id_opname_final: r.id_opname_final,
                id_toko: r.id_toko,
                nomor_ulok: r.nomor_ulok,
                nama_toko: r.nama_toko,
                cabang: r.cabang,
                nama_kontraktor: r.nama_kontraktor,
                hari_denda: r.hari_denda,
                nilai_denda: r.nilai_denda,
                kerja_tambah: Number(r.selisih_kerja) > 0 ? Number(r.selisih_kerja) : 0,
                kerja_kurang: Number(r.selisih_kerja) < 0 ? Math.abs(Number(r.selisih_kerja)) : 0,
                kualitas,
                desain,
                spesifikasi,
                nilai_toko: Number(nilai_toko),
                scopes: r.scopes || []
            };
        });
    },

    async getDrilldownDetail(idToko: string, lingkup: string): Promise<any> {
        // Context-aware detail implies we return everything for the Slide-Out panel,
        // and let the frontend pick what to emphasize based on the context.
        const query = `
            SELECT 
                t.nomor_toko,
                t.nama_toko,
                t.cabang,
                t.jenis_pekerjaan,
                COALESCE(NULLIF(TRIM(ps.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                ps.lingkup_pekerjaan,
                ofn.hari_denda,
                ofn.nilai_denda,
                ofn.grand_total_opname,
                ps.grand_total as spk_total,
                (ofn.grand_total_opname - ps.grand_total) as selisih_kerja,
                (SELECT json_agg(
                        json_build_object(
                            'kualitas', oi.kualitas,
                            'desain', oi.desain,
                            'spesifikasi', oi.spesifikasi
                        )
                    ) FROM opname_item oi WHERE oi.id_opname_final = ofn.id) as item_stats
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id 
                AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                AND UPPER(ps.lingkup_pekerjaan) = UPPER($2)
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            WHERE t.id = $1
            LIMIT 1
        `;
        const result = await pool.query(query, [idToko, lingkup]);
        return result.rows[0];
    }
};
