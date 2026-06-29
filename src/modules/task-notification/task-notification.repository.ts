import { getBranchScopeCandidates } from "../../common/branch-scope";
import { pool } from "../../db/pool";
import type { AuthenticatedUser } from "../auth/auth-session.service";

const SUPPORT_ROLES = new Set([
    "BRANCH BUILDING SUPPORT",
    "BUILDING & MAINTENANCE SUPER HUMAN",
]);

const normalize = (value?: string | null) =>
    String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

const canViewAllBranches = (user: AuthenticatedUser) =>
    normalize(user.cabang) === "HEAD OFFICE"
    || user.roles.some(role => [
        "BUILDING & MAINTENANCE SUPER HUMAN",
        "BUILDING & MAINTENANCE REGIONAL MANAGER",
        "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER",
        "BUILDING & MAINTENANCE GENERAL MANAGER",
        "STORE & BRANCH CONTROLLING SPECIALIST"
    ].includes(normalize(role)));

const canReceiveSupportKtk = (user: AuthenticatedUser) =>
    user.roles.some(role => SUPPORT_ROLES.has(normalize(role)));

export type SupportKtkReadyNotificationRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    lingkup_pekerjaan: string | null;
    nama_kontraktor: string | null;
    opname_final_id: number;
    expected_item_count: number;
    approved_item_count: number;
    created_at: string;
};

export const taskNotificationRepository = {
    async findSupportKtkReady(user: AuthenticatedUser): Promise<SupportKtkReadyNotificationRow[]> {
        if (!canReceiveSupportKtk(user)) return [];

        const values: Array<string | string[]> = [];
        const branchConditions: string[] = [];
        if (!canViewAllBranches(user)) {
            const branches = getBranchScopeCandidates(user.cabang);
            values.push(branches);
            branchConditions.push(`UPPER(TRIM(t.cabang)) = ANY($${values.length}::text[])`);
        }

        const whereBranch = branchConditions.length ? `AND ${branchConditions.join(" AND ")}` : "";

        const result = await pool.query<SupportKtkReadyNotificationRow>(
            `
            WITH latest_active_final AS (
                SELECT DISTINCT ON (ofn.id_toko)
                    ofn.id,
                    ofn.id_toko,
                    ofn.created_at
                FROM opname_final ofn
                WHERE COALESCE(ofn.aksi, 'active') <> 'terkunci'
                  AND COALESCE(ofn.status_opname_final, '') = 'Proses KTK/Approval Kontraktor'
                ORDER BY ofn.id_toko, ofn.id DESC
            ),
            latest_approved_rab AS (
                SELECT DISTINCT ON (r.id_toko)
                    r.id,
                    r.id_toko
                FROM rab r
                WHERE UPPER(COALESCE(r.status, '')) IN ('DISETUJUI', 'APPROVED')
                ORDER BY r.id_toko, r.created_at DESC, r.id DESC
            ),
            expected_rab AS (
                SELECT
                    lar.id_toko,
                    COUNT(ri.id)::int AS expected_count
                FROM latest_approved_rab lar
                JOIN rab_item ri ON ri.id_rab = lar.id
                GROUP BY lar.id_toko
            ),
            expected_il AS (
                SELECT
                    il.id_toko,
                    COUNT(ili.id)::int AS expected_count
                FROM instruksi_lapangan il
                JOIN instruksi_lapangan_item ili ON ili.id_instruksi_lapangan = il.id
                WHERE UPPER(COALESCE(il.status, '')) IN ('DISETUJUI', 'APPROVED')
                GROUP BY il.id_toko
            ),
            expected_total AS (
                SELECT
                    id_toko,
                    SUM(expected_count)::int AS expected_count
                FROM (
                    SELECT * FROM expected_rab
                    UNION ALL
                    SELECT * FROM expected_il
                ) expected_sources
                GROUP BY id_toko
            ),
            approved_latest_items AS (
                SELECT
                    latest_items.id_opname_final,
                    COUNT(*)::int AS approved_count
                FROM (
                    SELECT DISTINCT ON (
                        oi.id_opname_final,
                        COALESCE('rab:' || oi.id_rab_item::text, 'il:' || oi.id_instruksi_lapangan_item::text)
                    )
                        oi.id_opname_final,
                        oi.status
                    FROM opname_item oi
                    JOIN latest_active_final laf ON laf.id = oi.id_opname_final
                    WHERE oi.id_rab_item IS NOT NULL OR oi.id_instruksi_lapangan_item IS NOT NULL
                    ORDER BY
                        oi.id_opname_final,
                        COALESCE('rab:' || oi.id_rab_item::text, 'il:' || oi.id_instruksi_lapangan_item::text),
                        oi.id DESC
                ) latest_items
                WHERE LOWER(COALESCE(latest_items.status, '')) = 'disetujui'
                GROUP BY latest_items.id_opname_final
            )
            SELECT
                laf.id,
                laf.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.kode_toko,
                t.proyek,
                t.cabang,
                t.lingkup_pekerjaan,
                t.nama_kontraktor,
                laf.id AS opname_final_id,
                COALESCE(et.expected_count, 0)::int AS expected_item_count,
                COALESCE(ali.approved_count, 0)::int AS approved_item_count,
                laf.created_at
            FROM latest_active_final laf
            JOIN toko t ON t.id = laf.id_toko
            JOIN expected_total et ON et.id_toko = laf.id_toko
            JOIN approved_latest_items ali ON ali.id_opname_final = laf.id
            WHERE COALESCE(et.expected_count, 0) > 0
              AND COALESCE(ali.approved_count, 0) >= COALESCE(et.expected_count, 0)
              ${whereBranch}
            ORDER BY laf.created_at DESC, laf.id DESC
            LIMIT 50
            `,
            values
        );

        return result.rows;
    }
};
