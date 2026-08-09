import { pool } from "../../db/pool";
import type { DashboardKpiQueryInput } from "./dashboard.schema";

export const dashboardKpiService = {
    async getKpiPerformance(query: DashboardKpiQueryInput) {
        // Base where clause for scoping based on roles and filters
        const baseWhere = ["1=1"];
        const params: any[] = [];
        
        // Example handling of branch and roles
        if (query.cabang && query.cabang !== "ALL" && query.cabang !== "Semua Cabang") {
            params.push(query.cabang);
            baseWhere.push(`toko.cabang = $${params.length}`);
        } else if (query.actor_cabang !== "HEAD OFFICE") {
            params.push(query.actor_cabang);
            baseWhere.push(`toko.cabang = $${params.length}`);
        }

        // Example handling of coordinator and support
        // Note: toko table does not have koordinator or building_support columns. 
        // We will need to join with another table (like rab) to filter by koordinator later.
        // if (query.coordinator && query.coordinator !== "ALL") {
        //     params.push(`%${query.coordinator}%`);
        //     baseWhere.push(`toko.koordinator ILIKE $${params.length}`);
        // }
        // if (query.support && query.support !== "ALL") {
        //     params.push(`%${query.support}%`);
        //     baseWhere.push(`toko.building_support ILIKE $${params.length}`);
        // }

        const whereClause = baseWhere.join(" AND ");

        // We will execute a single complex query or multiple simpler queries to get the 11 KPIs.
        // For demonstration, let's aggregate them in a few passes.
        
        // Pass 1: Cost/m2, JHK, Denda, Keterlambatan, KTK
        const kpiQuery = `
            SELECT 
                COALESCE(AVG(NULLIF(CASE WHEN rab.luas_bangunan ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.luas_bangunan, ',', '.') AS NUMERIC) ELSE 0 END, 0)), 0) as avg_luas,
                COALESCE(AVG(NULLIF(CASE WHEN rab.grand_total_final ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.grand_total_final, ',', '.') AS NUMERIC) ELSE 0 END, 0) / NULLIF(CASE WHEN rab.luas_bangunan ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.luas_bangunan, ',', '.') AS NUMERIC) ELSE 0 END, 0)), 0) as avg_cost_m2,
                COALESCE(AVG(NULLIF(spk.durasi, 0)), 0) as avg_jhk,
                COALESCE(AVG(NULLIF(opname_final.nilai_denda, 0)), 0) as avg_denda,
                COALESCE(AVG(NULLIF(opname_final.hari_denda, 0)), 0) as avg_keterlambatan,
                
                COALESCE(AVG(
                    CASE 
                        WHEN opname_final.grand_total_opname ~ '^[0-9\.\,]+$' AND opname_final.grand_total_rab ~ '^[0-9\.\,]+$'
                        AND CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) > CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                        THEN CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) - CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                    ELSE 0 END
                ), 0) as avg_kerja_tambah,
                
                COALESCE(AVG(
                    CASE 
                        WHEN opname_final.grand_total_opname ~ '^[0-9\.\,]+$' AND opname_final.grand_total_rab ~ '^[0-9\.\,]+$'
                        AND CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) < CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                        THEN CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC) - CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC)
                    ELSE 0 END
                ), 0) as avg_kerja_kurang,

                COALESCE(AVG(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_koordinator - rab.created_at))/86400), 0) as avg_sla_coord,
                COALESCE(AVG(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_manager - rab.waktu_persetujuan_koordinator))/86400), 0) as avg_sla_bm,
                COALESCE(AVG(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_direktur - rab.waktu_persetujuan_manager))/86400), 0) as avg_sla_branch_manager,
                
                COALESCE(AVG(EXTRACT(EPOCH FROM (opname_final.tanggal_serah_terima_denda::timestamp - spk.waktu_selesai))/86400), 0) as avg_ketepatan_st,
                COALESCE(AVG(EXTRACT(EPOCH FROM (opname_final.created_at - opname_final.tanggal_serah_terima_denda::timestamp))/86400), 0) as avg_sla_ktk

            FROM toko
            LEFT JOIN rab ON rab.id_toko = toko.id AND rab.status = 'Disetujui'
            LEFT JOIN pengajuan_spk spk ON spk.id_toko = toko.id AND spk.status IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI')
            LEFT JOIN opname_final ON opname_final.id_toko = toko.id
            LEFT JOIN pic_pengawasan pic ON pic.id_toko = toko.id
            WHERE ${whereClause}
        `;

        const kpiResult = await pool.query(kpiQuery, params);
        const row = kpiResult.rows[0] || {};

        // Pass 2: SLA Approvals (Assuming simple difference of dates if available, or mock if we need to parse logs)
        // Since we don't have exact table structure for logs, we use dummy logic or extracted dates from main tables
        // For this implementation, we will use mock values for SLA if actual logs are complex to parse in SQL without knowing table schema
        // Ideally:
        // avg_sla_coord = AVG(approved_by_coord_date - submitted_to_coord_date)
        

        return {
            avg_cost_m2: Number(row.avg_cost_m2) || 0,
            avg_jhk: Number(row.avg_jhk) || 0,
            avg_denda: Number(row.avg_denda) || 0,
            avg_keterlambatan: Number(row.avg_keterlambatan) || 0,
            avg_kerja_tambah: Number(row.avg_kerja_tambah) || 0,
            avg_kerja_kurang: Number(row.avg_kerja_kurang) || 0,
            avg_sla_coord: Number(row.avg_sla_coord) || 0,
            avg_sla_bm: Number(row.avg_sla_bm) || 0,
            avg_sla_branch_manager: Number(row.avg_sla_branch_manager) || 0,
            avg_ketepatan_st: Number(row.avg_ketepatan_st) || 0,
            avg_sla_ktk: Number(row.avg_sla_ktk) || 0
        };
    },

    async getKpiFilters(query: any) {
        // Query distinct koordinator from rab and support from pic_pengawasan
        // This is a simplified version, applying the same branch filter if necessary
        const { branches } = query;
        let whereClause = "1=1";
        if (branches && branches.length > 0 && !branches.includes('ALL')) {
            whereClause += ` AND t.cabang = ANY(ARRAY[${branches.map((b: string) => `'${b}'`).join(',')}])`;
        }

        const coordQuery = `
            SELECT DISTINCT r.pemberi_persetujuan_koordinator as name
            FROM rab r
            LEFT JOIN toko t ON t.id = r.id_toko
            WHERE r.pemberi_persetujuan_koordinator IS NOT NULL AND r.pemberi_persetujuan_koordinator != '' AND ${whereClause}
            ORDER BY 1
        `;
        const supportQuery = `
            SELECT DISTINCT p.plc_building_support as name
            FROM pic_pengawasan p
            LEFT JOIN toko t ON t.id = p.id_toko
            WHERE p.plc_building_support IS NOT NULL AND p.plc_building_support != '' AND ${whereClause}
            ORDER BY 1
        `;

        const [coordRes, supportRes] = await Promise.all([
            pool.query(coordQuery),
            pool.query(supportQuery)
        ]);

        return {
            coordinators: coordRes.rows.map(r => r.name),
            supports: supportRes.rows.map(r => r.name)
        };
    },

    async getKpiDrilldown(query: any) {
        const { branches, kpi_type, coordinator, support } = query;
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 20;
        const offset = (page - 1) * limit;

        let baseWhere = ["1=1"];
        let params: any[] = [];
        
        if (branches && branches.length > 0 && !branches.includes('ALL')) {
            baseWhere.push(`toko.cabang = ANY($${params.length + 1})`);
            params.push(branches);
        }
        if (coordinator && coordinator !== "ALL") {
            baseWhere.push(`rab.pemberi_persetujuan_koordinator = $${params.length + 1}`);
            params.push(coordinator);
        }
        if (support && support !== "ALL") {
            baseWhere.push(`pic.plc_building_support = $${params.length + 1}`);
            params.push(support);
        }

        const whereClause = baseWhere.join(" AND ");

        // Determine columns to select and the order by logic
        let selectCols = `toko.id as id_toko, toko.nama_toko as proyek, toko.cabang, COUNT(*) OVER() as total_count`;
        let orderClause = ``;
        let extraJoins = `
            LEFT JOIN rab ON rab.id_toko = toko.id AND rab.status = 'Disetujui'
            LEFT JOIN pengajuan_spk spk ON spk.id_toko = toko.id AND spk.status IN ('SPK_APPROVED', 'ACTIVE', 'SELESAI')
            LEFT JOIN opname_final ON opname_final.id_toko = toko.id
            LEFT JOIN pic_pengawasan pic ON pic.id_toko = toko.id
        `;

        if (kpi_type === "cost_m2") {
            selectCols += `, 
                NULLIF(CASE WHEN rab.grand_total_final ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.grand_total_final, ',', '.') AS NUMERIC) ELSE 0 END, 0) as total,
                NULLIF(CASE WHEN rab.luas_bangunan ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.luas_bangunan, ',', '.') AS NUMERIC) ELSE 0 END, 0) as luas,
                (NULLIF(CASE WHEN rab.grand_total_final ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.grand_total_final, ',', '.') AS NUMERIC) ELSE 0 END, 0) / 
                NULLIF(CASE WHEN rab.luas_bangunan ~ '^[0-9\.\,]+$' THEN CAST(REPLACE(rab.luas_bangunan, ',', '.') AS NUMERIC) ELSE 0 END, 0)) as info
            `;
            orderClause = `ORDER BY info DESC NULLS LAST`;
        } else if (kpi_type === "jhk") {
            selectCols += `, ROUND(CAST(NULLIF(spk.durasi, 0) AS NUMERIC), 0) as info`;
            orderClause = `ORDER BY CAST(NULLIF(spk.durasi, 0) AS NUMERIC) DESC NULLS LAST`;
        } else if (kpi_type === "denda") {
            selectCols += `, opname_final.nilai_denda as info`;
            baseWhere.push(`CAST(NULLIF(opname_final.nilai_denda, 0) AS NUMERIC) > 0`);
            orderClause = `ORDER BY CAST(NULLIF(opname_final.nilai_denda, 0) AS NUMERIC) DESC NULLS LAST`;
        } else if (kpi_type === "keterlambatan") {
            selectCols += `, ROUND(CAST(NULLIF(opname_final.hari_denda, 0) AS NUMERIC), 0) as info`;
            baseWhere.push(`CAST(NULLIF(opname_final.hari_denda, 0) AS NUMERIC) > 0`);
            orderClause = `ORDER BY CAST(NULLIF(opname_final.hari_denda, 0) AS NUMERIC) DESC NULLS LAST`;
        } else if (kpi_type === "ktk_nominal") {
            selectCols += `, 
                CASE 
                    WHEN opname_final.grand_total_opname ~ '^[0-9\.\,]+$' AND opname_final.grand_total_rab ~ '^[0-9\.\,]+$'
                    AND CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) > CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                    THEN CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) - CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                ELSE 0 END as tambah,
                CASE 
                    WHEN opname_final.grand_total_opname ~ '^[0-9\.\,]+$' AND opname_final.grand_total_rab ~ '^[0-9\.\,]+$'
                    AND CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC) < CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC)
                    THEN CAST(REPLACE(opname_final.grand_total_rab, ',', '.') AS NUMERIC) - CAST(REPLACE(opname_final.grand_total_opname, ',', '.') AS NUMERIC)
                ELSE 0 END as kurang
            `;
            orderClause = `ORDER BY tambah DESC, kurang DESC NULLS LAST`;
        } else if (kpi_type === "sla_approval") {
            selectCols += `, 
                ROUND(CAST(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_koordinator - rab.created_at))/86400 AS NUMERIC), 0) as coord_days,
                ROUND(CAST(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_manager - rab.waktu_persetujuan_koordinator))/86400 AS NUMERIC), 0) as mgr_days,
                ROUND(CAST(EXTRACT(EPOCH FROM (rab.waktu_persetujuan_direktur - rab.waktu_persetujuan_manager))/86400 AS NUMERIC), 0) as bm_days
            `;
            orderClause = `ORDER BY mgr_days DESC NULLS LAST`;
        } else if (kpi_type === "ketepatan_st") {
            selectCols += `, ROUND(CAST(EXTRACT(EPOCH FROM (opname_final.tanggal_serah_terima_denda::timestamp - spk.waktu_selesai))/86400 AS NUMERIC), 0) as info`;
            orderClause = `ORDER BY info DESC NULLS LAST`;
        } else if (kpi_type === "sla_ktk") {
            selectCols += `, ROUND(CAST(EXTRACT(EPOCH FROM (opname_final.created_at - opname_final.tanggal_serah_terima_denda::timestamp))/86400 AS NUMERIC), 0) as info`;
            orderClause = `ORDER BY info DESC NULLS LAST`;
        } else {
            selectCols += `, 'Invalid Type' as info`;
        }

        const sql = `
            SELECT ${selectCols}
            FROM toko
            ${extraJoins}
            WHERE ${whereClause}
            ${orderClause}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        
        params.push(limit, offset);
        const result = await pool.query(sql, params);
        
        let total = 0;
        if (result.rows.length > 0) {
            total = parseInt(result.rows[0].total_count) || 0;
        }
        
        const data = result.rows.map((r: any) => {
            const { total_count, ...rest } = r;
            return rest;
        });

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
};
