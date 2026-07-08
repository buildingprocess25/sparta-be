import { pool } from "../../db/pool";
import type { DendaActionStatus, DendaActionType, ListDendaActionsQuery, SpReason } from "./denda-action.schema";
import { getEffectiveBranchesForUser } from "../../common/branch-scope";
import type { AuthenticatedUser } from "../auth/auth-session.service";

export type DendaActionCandidateRow = {
    opname_final_id: number | null;
    id_toko: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    nama_kontraktor: string | null;
    nomor_spk: string | null;
    hari_denda: number;
    nilai_denda: string;
    tanggal_akhir_spk_denda: string | null;
    tanggal_serah_terima_denda: string | null;
    active_sp_count: number;
    next_sp_level: number | null;
    has_pending_approval: boolean;
    latest_action_type: DendaActionType | null;
    latest_action_status: DendaActionStatus | null;
    latest_action_created_at: string | null;
    latest_action_expires_at: string | null;
    latest_action_is_expired: boolean;
};

export type DendaActionRow = {
    id: number;
    id_toko: number;
    id_opname_final: number | null;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    cabang: string | null;
    nama_kontraktor: string | null;
    nomor_spk: string | null;
    action_type: DendaActionType;
    status: DendaActionStatus;
    sp_level: number | null;
    hari_denda: number;
    nilai_denda: string;
    alasan_sp: SpReason | null;
    catatan: string | null;
    instruksi_tindak_lanjut: string | null;
    deadline_tindak_lanjut: string | null;
    lampiran_1_url: string | null;
    lampiran_2_url: string | null;
    nomor_surat: string | null;
    link_pdf: string | null;
    submitted_by_email: string | null;
    submitted_by_role: string | null;
    submitted_at: string | null;
    manager_approved_by: string | null;
    manager_approved_role: string | null;
    manager_approved_at: string | null;
    manager_rejected_by: string | null;
    manager_rejected_role: string | null;
    manager_rejected_at: string | null;
    manager_rejected_reason: string | null;
    sent_to_contractor_at: string | null;
    viewed_by_contractor_at: string | null;
    acknowledged_by_contractor_at: string | null;
    expires_at: string | null;
    actor_email: string | null;
    actor_role: string | null;
    created_at: string;
    updated_at: string;
    is_expired: boolean;
    is_active: boolean;
};

export type DendaActionTargetRow = {
    id_opname_final: number | null;
    id_toko: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    cabang: string | null;
    nama_kontraktor: string | null;
    nomor_spk: string | null;
    hari_denda: number;
    nilai_denda: string;
};

const ACTION_SELECT = `
    id, id_toko, id_opname_final, nomor_ulok, lingkup_pekerjaan, cabang, nama_kontraktor, nomor_spk,
    action_type, status, sp_level, hari_denda, nilai_denda, alasan_sp, catatan,
    instruksi_tindak_lanjut, deadline_tindak_lanjut, lampiran_1_url, lampiran_2_url,
    nomor_surat, link_pdf, submitted_by_email, submitted_by_role, submitted_at,
    manager_approved_by, manager_approved_role, manager_approved_at,
    manager_rejected_by, manager_rejected_role, manager_rejected_at, manager_rejected_reason,
    sent_to_contractor_at, viewed_by_contractor_at, acknowledged_by_contractor_at, expires_at,
    actor_email, actor_role, created_at, updated_at,
    (expires_at IS NOT NULL AND expires_at < timezone('Asia/Jakarta', now())) AS is_expired,
    (
        action_type = 'SP'
        AND status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
        AND (expires_at IS NULL OR expires_at >= timezone('Asia/Jakarta', now()))
    ) AS is_active
`;

export const dendaActionRepository = {
    async ensureSchema(): Promise<void> {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS denda_keterlambatan_action (
                id BIGSERIAL PRIMARY KEY,
                id_toko INTEGER REFERENCES toko(id) ON DELETE CASCADE,
                id_opname_final INTEGER REFERENCES opname_final(id) ON DELETE CASCADE,
                nomor_ulok TEXT,
                lingkup_pekerjaan TEXT,
                cabang TEXT,
                nama_kontraktor TEXT,
                nomor_spk TEXT,
                action_type TEXT NOT NULL CHECK (action_type IN ('SP', 'TAKEOVER')),
                status TEXT NOT NULL DEFAULT 'WAITING_MANAGER',
                sp_level INTEGER,
                hari_denda INTEGER NOT NULL,
                nilai_denda NUMERIC NOT NULL DEFAULT 0,
                alasan_sp TEXT,
                catatan TEXT,
                instruksi_tindak_lanjut TEXT,
                deadline_tindak_lanjut DATE,
                lampiran_1_url TEXT,
                lampiran_2_url TEXT,
                nomor_surat TEXT,
                link_pdf TEXT,
                submitted_by_email TEXT,
                submitted_by_role TEXT,
                submitted_at TIMESTAMP,
                manager_approved_by TEXT,
                manager_approved_role TEXT,
                manager_approved_at TIMESTAMP,
                manager_rejected_by TEXT,
                manager_rejected_role TEXT,
                manager_rejected_at TIMESTAMP,
                manager_rejected_reason TEXT,
                sent_to_contractor_at TIMESTAMP,
                viewed_by_contractor_at TIMESTAMP,
                acknowledged_by_contractor_at TIMESTAMP,
                expires_at TIMESTAMP,
                actor_email TEXT,
                actor_role TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
                updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        await pool.query(`
            ALTER TABLE denda_keterlambatan_action
                ALTER COLUMN status SET DEFAULT 'WAITING_MANAGER',
                ALTER COLUMN id_toko DROP NOT NULL,
                ALTER COLUMN id_opname_final DROP NOT NULL,
                ADD COLUMN IF NOT EXISTS sp_level INTEGER,
                ADD COLUMN IF NOT EXISTS nama_kontraktor TEXT,
                ADD COLUMN IF NOT EXISTS nomor_spk TEXT,
                ADD COLUMN IF NOT EXISTS alasan_sp TEXT,
                ADD COLUMN IF NOT EXISTS instruksi_tindak_lanjut TEXT,
                ADD COLUMN IF NOT EXISTS deadline_tindak_lanjut DATE,
                ADD COLUMN IF NOT EXISTS lampiran_1_url TEXT,
                ADD COLUMN IF NOT EXISTS lampiran_2_url TEXT,
                ADD COLUMN IF NOT EXISTS nomor_surat TEXT,
                ADD COLUMN IF NOT EXISTS link_pdf TEXT,
                ADD COLUMN IF NOT EXISTS submitted_by_email TEXT,
                ADD COLUMN IF NOT EXISTS submitted_by_role TEXT,
                ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS manager_approved_by TEXT,
                ADD COLUMN IF NOT EXISTS manager_approved_role TEXT,
                ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS manager_rejected_by TEXT,
                ADD COLUMN IF NOT EXISTS manager_rejected_role TEXT,
                ADD COLUMN IF NOT EXISTS manager_rejected_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS manager_rejected_reason TEXT,
                ADD COLUMN IF NOT EXISTS sent_to_contractor_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS viewed_by_contractor_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS acknowledged_by_contractor_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
        `);

        await pool.query(`
            UPDATE denda_keterlambatan_action
            SET status = 'WAITING_MANAGER',
                submitted_by_email = COALESCE(submitted_by_email, actor_email),
                submitted_by_role = COALESCE(submitted_by_role, actor_role),
                submitted_at = COALESCE(submitted_at, created_at),
                updated_at = timezone('Asia/Jakarta', now())
            WHERE status = 'OPEN'
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_denda_action_opname_final
            ON denda_keterlambatan_action (id_opname_final, created_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_denda_action_toko
            ON denda_keterlambatan_action (id_toko, created_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_denda_action_status_expiry
            ON denda_keterlambatan_action (status, expires_at)
        `);
    },

    async listCandidates(cabang_array?: string[]): Promise<DendaActionCandidateRow[]> {
        const conditions = [
            `st.id IS NULL`,
            `NULLIF(TRIM(COALESCE(spk.nama_kontraktor, t.nama_kontraktor, '')), '') IS NOT NULL`
        ];
        const values: any[] = [];
        
        if (cabang_array && cabang_array.length > 0) {
            const normalizedBranches = cabang_array.map(b => b.trim().toUpperCase());
            values.push(normalizedBranches);
            conditions.push(`UPPER(t.cabang) = ANY($${values.length})`);
        }
        
        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        const result = await pool.query<DendaActionCandidateRow>(`
            WITH latest_opname AS (
                SELECT DISTINCT ON (ofn.id_toko)
                    ofn.id,
                    ofn.id_toko,
                    ofn.hari_denda,
                    ofn.nilai_denda,
                    ofn.tanggal_akhir_spk_denda,
                    ofn.tanggal_serah_terima_denda,
                    ofn.created_at
                FROM opname_final ofn
                ORDER BY ofn.id_toko, ofn.created_at DESC NULLS LAST, ofn.id DESC
            )
            SELECT
                ofn.id AS opname_final_id,
                t.id AS id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.nama_toko,
                t.kode_toko,
                t.cabang,
                COALESCE(NULLIF(TRIM(spk.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                spk.nomor_spk,
                GREATEST(COALESCE(ofn.hari_denda, 0), COALESCE(delay.hari_terlambat, 0))::int AS hari_denda,
                GREATEST(COALESCE(ofn.nilai_denda, 0), COALESCE(delay.nilai_terlambat, 0))::text AS nilai_denda,
                COALESCE(ofn.tanggal_akhir_spk_denda, spk.effective_waktu_selesai) AS tanggal_akhir_spk_denda,
                ofn.tanggal_serah_terima_denda,
                COALESCE(sp_stats.active_sp_count, 0)::int AS active_sp_count,
                CASE
                    WHEN COALESCE(sp_stats.active_sp_count, 0) >= 3 THEN NULL
                    ELSE (COALESCE(sp_stats.active_sp_count, 0) + 1)::int
                END AS next_sp_level,
                COALESCE(sp_stats.pending_approval_count, 0) > 0 AS has_pending_approval,
                latest_action.action_type AS latest_action_type,
                latest_action.status AS latest_action_status,
                latest_action.created_at AS latest_action_created_at,
                latest_action.expires_at AS latest_action_expires_at,
                COALESCE(latest_action.expires_at < timezone('Asia/Jakarta', now()), false) AS latest_action_is_expired
            FROM toko t
            LEFT JOIN latest_opname ofn ON ofn.id_toko = t.id
            LEFT JOIN LATERAL (
                SELECT
                    ps.nomor_spk,
                    ps.nama_kontraktor,
                    COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_waktu_selesai
                FROM pengajuan_spk ps
                LEFT JOIN LATERAL (
                    SELECT MAX(parsed_extension_date) AS approved_until
                    FROM (
                        SELECT
                            CASE
                                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                                ELSE NULL::date
                            END AS parsed_extension_date
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
                    ) parsed
                ) extension ON TRUE
                WHERE ps.id_toko = t.id
                ORDER BY ps.created_at DESC NULLS LAST, ps.id DESC
                LIMIT 1
            ) spk ON TRUE
            LEFT JOIN LATERAL (
                WITH base AS (
                    SELECT
                        spk.effective_waktu_selesai AS end_date,
                        (timezone('Asia/Jakarta', now()))::date AS today
                ),
                free_day AS (
                    SELECT
                        CASE
                            WHEN end_date IS NULL THEN NULL::date
                            WHEN EXTRACT(ISODOW FROM end_date + 1) = 6 THEN end_date + 3
                            WHEN EXTRACT(ISODOW FROM end_date + 1) = 7 THEN end_date + 2
                            ELSE end_date + 1
                        END AS free_date,
                        today
                    FROM base
                ),
                counted AS (
                    SELECT COUNT(*)::int AS hari
                    FROM free_day,
                    LATERAL generate_series(free_date + 1, today, INTERVAL '1 day') AS day(value)
                    WHERE free_date IS NOT NULL
                      AND today > free_date
                      AND EXTRACT(ISODOW FROM day.value) BETWEEN 1 AND 5
                )
                SELECT
                    COALESCE(hari, 0)::int AS hari_terlambat,
                    LEAST(
                        (LEAST(COALESCE(hari, 0), 5) * 1000000)
                        + (GREATEST(0, LEAST(COALESCE(hari, 0) - 5, 5)) * 500000),
                        7500000
                    )::numeric AS nilai_terlambat
                FROM counted
            ) delay ON TRUE
            LEFT JOIN LATERAL (
                SELECT id
                FROM berkas_serah_terima bst
                WHERE bst.id_toko = t.id
                ORDER BY bst.created_at DESC NULLS LAST, bst.id DESC
                LIMIT 1
            ) st ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) FILTER (
                        WHERE action_type = 'SP'
                          AND status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
                          AND (expires_at IS NULL OR expires_at >= timezone('Asia/Jakarta', now()))
                    ) AS active_sp_count,
                    COUNT(*) FILTER (WHERE status = 'WAITING_MANAGER') AS pending_approval_count
                FROM denda_keterlambatan_action action
                WHERE action.id_toko = t.id
            ) sp_stats ON TRUE
            LEFT JOIN LATERAL (
                SELECT action_type, status, created_at, expires_at
                FROM denda_keterlambatan_action action
                WHERE action.id_toko = t.id
                ORDER BY action.created_at DESC, action.id DESC
                LIMIT 1
            ) latest_action ON TRUE
            ${whereClause}
            ORDER BY GREATEST(COALESCE(ofn.hari_denda, 0), COALESCE(delay.hari_terlambat, 0)) DESC, ofn.created_at DESC NULLS LAST, t.id DESC
        `, values);

        return result.rows;
    },

    async listActions(query: ListDendaActionsQuery): Promise<DendaActionRow[]> {
        const filters: string[] = [];
        const values: Array<string | number> = [];

        if (query.id_toko) {
            values.push(query.id_toko);
            filters.push(`id_toko = $${values.length}`);
        }

        if (query.id_opname_final) {
            values.push(query.id_opname_final);
            filters.push(`id_opname_final = $${values.length}`);
        }

        if (query.nomor_ulok) {
            values.push(query.nomor_ulok);
            filters.push(`UPPER(TRIM(COALESCE(nomor_ulok, ''))) = UPPER(TRIM($${values.length}::text))`);
        }

        if (query.action_type) {
            values.push(query.action_type);
            filters.push(`action_type = $${values.length}`);
        }

        if (query.cabang_array && query.cabang_array.length > 0) {
            const normalizedBranches = query.cabang_array.map(b => b.trim().toUpperCase());
            values.push(normalizedBranches as any);
            filters.push(`UPPER(cabang) = ANY($${values.length})`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const result = await pool.query<DendaActionRow>(
            `
            SELECT ${ACTION_SELECT}
            FROM denda_keterlambatan_action
            ${whereClause}
            ORDER BY created_at DESC, id DESC
            `,
            values
        );

        return result.rows;
    },

    async findActionById(id: number): Promise<DendaActionRow | null> {
        const result = await pool.query<DendaActionRow>(
            `
            SELECT ${ACTION_SELECT}
            FROM denda_keterlambatan_action
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findTargetByOpnameFinalId(idOpnameFinal: number): Promise<DendaActionTargetRow | null> {
        const result = await pool.query<DendaActionTargetRow>(
            `
            SELECT
                ofn.id AS id_opname_final,
                ofn.id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                t.nama_kontraktor,
                spk.nomor_spk,
                COALESCE(ofn.hari_denda, 0)::int AS hari_denda,
                COALESCE(ofn.nilai_denda, 0)::text AS nilai_denda
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            LEFT JOIN LATERAL (
                SELECT nomor_spk
                FROM pengajuan_spk ps
                WHERE ps.id_toko = ofn.id_toko
                  AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                ORDER BY ps.created_at DESC NULLS LAST, ps.id DESC
                LIMIT 1
            ) spk ON TRUE
            WHERE ofn.id = $1
            LIMIT 1
            `,
            [idOpnameFinal]
        );

        return result.rows[0] ?? null;
    },

    async findTargetByTokoId(idToko: number): Promise<DendaActionTargetRow | null> {
        const result = await pool.query<DendaActionTargetRow>(
            `
            SELECT
                ofn.id AS id_opname_final,
                t.id AS id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                COALESCE(NULLIF(TRIM(spk.nama_kontraktor), ''), NULLIF(TRIM(t.nama_kontraktor), '')) AS nama_kontraktor,
                spk.nomor_spk,
                GREATEST(COALESCE(ofn.hari_denda, 0), COALESCE(delay.hari_terlambat, 0))::int AS hari_denda,
                GREATEST(COALESCE(ofn.nilai_denda, 0), COALESCE(delay.nilai_terlambat, 0))::text AS nilai_denda
            FROM toko t
            LEFT JOIN LATERAL (
                SELECT id, hari_denda, nilai_denda
                FROM opname_final latest
                WHERE latest.id_toko = t.id
                ORDER BY latest.created_at DESC NULLS LAST, latest.id DESC
                LIMIT 1
            ) ofn ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    ps.nomor_spk,
                    ps.nama_kontraktor,
                    COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_waktu_selesai
                FROM pengajuan_spk ps
                LEFT JOIN LATERAL (
                    SELECT MAX(parsed_extension_date) AS approved_until
                    FROM (
                        SELECT
                            CASE
                                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                                ELSE NULL::date
                            END AS parsed_extension_date
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
                    ) parsed
                ) extension ON TRUE
                WHERE ps.id_toko = t.id
                ORDER BY ps.created_at DESC NULLS LAST, ps.id DESC
                LIMIT 1
            ) spk ON TRUE
            LEFT JOIN LATERAL (
                WITH base AS (
                    SELECT
                        spk.effective_waktu_selesai AS end_date,
                        (timezone('Asia/Jakarta', now()))::date AS today
                ),
                free_day AS (
                    SELECT
                        CASE
                            WHEN end_date IS NULL THEN NULL::date
                            WHEN EXTRACT(ISODOW FROM end_date + 1) = 6 THEN end_date + 3
                            WHEN EXTRACT(ISODOW FROM end_date + 1) = 7 THEN end_date + 2
                            ELSE end_date + 1
                        END AS free_date,
                        today
                    FROM base
                ),
                counted AS (
                    SELECT COUNT(*)::int AS hari
                    FROM free_day,
                    LATERAL generate_series(free_date + 1, today, INTERVAL '1 day') AS day(value)
                    WHERE free_date IS NOT NULL
                      AND today > free_date
                      AND EXTRACT(ISODOW FROM day.value) BETWEEN 1 AND 5
                )
                SELECT
                    COALESCE(hari, 0)::int AS hari_terlambat,
                    LEAST(
                        (LEAST(COALESCE(hari, 0), 5) * 1000000)
                        + (GREATEST(0, LEAST(COALESCE(hari, 0) - 5, 5)) * 500000),
                        7500000
                    )::numeric AS nilai_terlambat
                FROM counted
            ) delay ON TRUE
            LEFT JOIN LATERAL (
                SELECT id
                FROM berkas_serah_terima bst
                WHERE bst.id_toko = t.id
                ORDER BY bst.created_at DESC NULLS LAST, bst.id DESC
                LIMIT 1
            ) st ON TRUE
            WHERE t.id = $1
              AND st.id IS NULL
              AND NULLIF(TRIM(COALESCE(spk.nama_kontraktor, t.nama_kontraktor, '')), '') IS NOT NULL
            LIMIT 1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async getActionStatsByOpnameFinalId(idOpnameFinal: number): Promise<{
        active_sp_count: number;
        pending_approval_count: number;
    }> {
        const result = await pool.query<{ active_sp_count: string; pending_approval_count: string }>(
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE action_type = 'SP'
                      AND status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
                      AND (expires_at IS NULL OR expires_at >= timezone('Asia/Jakarta', now()))
                ) AS active_sp_count,
                COUNT(*) FILTER (WHERE status = 'WAITING_MANAGER') AS pending_approval_count
            FROM denda_keterlambatan_action
            WHERE id_opname_final = $1
            `,
            [idOpnameFinal]
        );

        return {
            active_sp_count: Number(result.rows[0]?.active_sp_count ?? 0),
            pending_approval_count: Number(result.rows[0]?.pending_approval_count ?? 0),
        };
    },

    async getActionStatsByTokoId(idToko: number): Promise<{
        active_sp_count: number;
        pending_approval_count: number;
    }> {
        const result = await pool.query<{ active_sp_count: string; pending_approval_count: string }>(
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE action_type = 'SP'
                      AND status IN ('APPROVED', 'SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR')
                      AND (expires_at IS NULL OR expires_at >= timezone('Asia/Jakarta', now()))
                ) AS active_sp_count,
                COUNT(*) FILTER (WHERE status = 'WAITING_MANAGER') AS pending_approval_count
            FROM denda_keterlambatan_action
            WHERE id_toko = $1
            `,
            [idToko]
        );

        return {
            active_sp_count: Number(result.rows[0]?.active_sp_count ?? 0),
            pending_approval_count: Number(result.rows[0]?.pending_approval_count ?? 0),
        };
    },

    async createAction(input: {
        target?: DendaActionTargetRow;
        id_toko?: number;
        nama_kontraktor?: string;
        action_type: DendaActionType;
        sp_level?: number | null;
        alasan_sp?: SpReason | null;
        catatan: string;
        instruksi_tindak_lanjut?: string | null;
        deadline_tindak_lanjut?: string | null;
        lampiran_1_url?: string | null;
        lampiran_2_url?: string | null;
        actor_email?: string | null;
        actor_role?: string | null;
    }): Promise<DendaActionRow> {
        const result = await pool.query<{ id: string }>(
            `
            INSERT INTO denda_keterlambatan_action (
                id_toko,
                id_opname_final,
                nomor_ulok,
                lingkup_pekerjaan,
                cabang,
                nama_kontraktor,
                nomor_spk,
                action_type,
                status,
                sp_level,
                hari_denda,
                nilai_denda,
                alasan_sp,
                catatan,
                instruksi_tindak_lanjut,
                deadline_tindak_lanjut,
                lampiran_1_url,
                lampiran_2_url,
                submitted_by_email,
                submitted_by_role,
                submitted_at,
                actor_email,
                actor_role
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, 'WAITING_MANAGER', $9, $10, $11, $12, $13, $14, $15::date, $16, $17, $18, $19, timezone('Asia/Jakarta', now()), $18, $19
            )
            RETURNING id
            `,
            [
                input.id_toko ?? input.target?.id_toko ?? null,
                input.target?.id_opname_final ?? null,
                input.target?.nomor_ulok ?? null,
                input.target?.lingkup_pekerjaan ?? null,
                input.target?.cabang ?? null,
                input.nama_kontraktor ?? input.target?.nama_kontraktor ?? null,
                input.target?.nomor_spk ?? null,
                input.action_type,
                input.sp_level ?? null,
                input.target?.hari_denda ?? 0,
                input.target?.nilai_denda ?? '0',
                input.alasan_sp ?? null,
                input.catatan,
                input.instruksi_tindak_lanjut ?? null,
                input.deadline_tindak_lanjut ?? null,
                input.lampiran_1_url ?? null,
                input.lampiran_2_url ?? null,
                input.actor_email ?? null,
                input.actor_role ?? null,
            ]
        );

        const created = await this.findActionById(Number(result.rows[0].id));
        if (!created) throw new Error("Denda action was created but could not be loaded.");
        return created;
    },

    async approveAction(input: {
        id: number;
        actor_email?: string | null;
        actor_role?: string | null;
        nomor_surat?: string | null;
        link_pdf?: string | null;
    }): Promise<DendaActionRow> {
        const result = await pool.query<{ id: string }>(
            `
            UPDATE denda_keterlambatan_action
            SET status = 'APPROVED',
                manager_approved_by = $2,
                manager_approved_role = $3,
                manager_approved_at = timezone('Asia/Jakarta', now()),
                expires_at = CASE
                    WHEN action_type = 'SP' THEN timezone('Asia/Jakarta', now()) + INTERVAL '6 months'
                    ELSE expires_at
                END,
                nomor_surat = COALESCE($4, nomor_surat),
                link_pdf = COALESCE($5, link_pdf),
                updated_at = timezone('Asia/Jakarta', now())
            WHERE id = $1
              AND status = 'WAITING_MANAGER'
            RETURNING id
            `,
            [input.id, input.actor_email ?? null, input.actor_role ?? null, input.nomor_surat ?? null, input.link_pdf ?? null]
        );

        if (result.rowCount === 0) return null as never;
        const updated = await this.findActionById(Number(result.rows[0].id));
        if (!updated) throw new Error("Denda action was approved but could not be loaded.");
        return updated;
    },

    async rejectAction(input: {
        id: number;
        reason: string;
        actor_email?: string | null;
        actor_role?: string | null;
    }): Promise<DendaActionRow> {
        const result = await pool.query<{ id: string }>(
            `
            UPDATE denda_keterlambatan_action
            SET status = 'REJECTED_BY_MANAGER',
                manager_rejected_by = $2,
                manager_rejected_role = $3,
                manager_rejected_at = timezone('Asia/Jakarta', now()),
                manager_rejected_reason = $4,
                updated_at = timezone('Asia/Jakarta', now())
            WHERE id = $1
              AND status = 'WAITING_MANAGER'
            RETURNING id
            `,
            [input.id, input.actor_email ?? null, input.actor_role ?? null, input.reason]
        );

        if (result.rowCount === 0) return null as never;
        const updated = await this.findActionById(Number(result.rows[0].id));
        if (!updated) throw new Error("Denda action was rejected but could not be loaded.");
        return updated;
    },

    async listKontraktor(user?: AuthenticatedUser): Promise<string[]> {
        let branchFilter = "";
        let values: any[] = [];

        if (user) {
            const scope = await getEffectiveBranchesForUser({
                emailSat: user.email_sat,
                cabang: user.cabang,
                roles: user.roles
            });

            let branches = scope.branches;
            if (scope.source === "global" && user.cabang.toUpperCase() === "HEAD OFFICE") {
                // HO users should only see their own branch's contractors for Surat Peringatan
                branches = ["HEAD OFFICE"];
            }

            if (scope.source !== "global" || user.cabang.toUpperCase() === "HEAD OFFICE") {
                if (branches.length === 0) {
                    return [];
                }
                const placeholders = branches.map((_, i) => `$${i + 1}`).join(", ");
                branchFilter = `AND UPPER(TRIM(COALESCE(t.cabang, ''))) IN (${placeholders})`;
                values = branches;
            }
        }

        const result = await pool.query<{ nama_kontraktor: string }>(`
            SELECT DISTINCT nama_kontraktor
            FROM (
                SELECT TRIM(ps.nama_kontraktor) AS nama_kontraktor 
                FROM pengajuan_spk ps 
                LEFT JOIN toko t ON t.id = ps.id_toko
                WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL ${branchFilter}
                
                UNION
                
                SELECT TRIM(t.nama_kontraktor) AS nama_kontraktor 
                FROM toko t 
                WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL ${branchFilter}
            ) AS combined
            WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
            ORDER BY nama_kontraktor ASC
        `, values);
        return result.rows.map(row => row.nama_kontraktor);
    },
};







