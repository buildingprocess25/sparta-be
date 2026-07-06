import { pool } from "../../db/pool";
import type { DendaActionType, ListDendaActionsQuery } from "./denda-action.schema";

export type DendaActionCandidateRow = {
    opname_final_id: number;
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
    latest_action_type: DendaActionType | null;
    latest_action_status: string | null;
    latest_action_created_at: string | null;
};

export type DendaActionRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    cabang: string | null;
    action_type: DendaActionType;
    status: string;
    hari_denda: number;
    nilai_denda: string;
    catatan: string | null;
    link_pdf: string | null;
    actor_email: string | null;
    actor_role: string | null;
    created_at: string;
    updated_at: string;
};

export type DendaActionTargetRow = {
    id_opname_final: number;
    id_toko: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    cabang: string | null;
    hari_denda: number;
    nilai_denda: string;
};

const ACTION_SELECT = `
    id, id_toko, id_opname_final, nomor_ulok, lingkup_pekerjaan, cabang,
    action_type, status, hari_denda, nilai_denda, catatan, link_pdf,
    actor_email, actor_role, created_at, updated_at
`;

export const dendaActionRepository = {
    async ensureSchema(): Promise<void> {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS denda_keterlambatan_action (
                id BIGSERIAL PRIMARY KEY,
                id_toko INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
                id_opname_final INTEGER NOT NULL REFERENCES opname_final(id) ON DELETE CASCADE,
                nomor_ulok TEXT,
                lingkup_pekerjaan TEXT,
                cabang TEXT,
                action_type TEXT NOT NULL CHECK (action_type IN ('SP', 'TAKEOVER')),
                status TEXT NOT NULL DEFAULT 'OPEN',
                hari_denda INTEGER NOT NULL,
                nilai_denda NUMERIC NOT NULL DEFAULT 0,
                catatan TEXT,
                link_pdf TEXT,
                actor_email TEXT,
                actor_role TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
                updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_denda_action_opname_final
            ON denda_keterlambatan_action (id_opname_final, created_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_denda_action_toko
            ON denda_keterlambatan_action (id_toko, created_at DESC)
        `);
    },

    async listCandidates(): Promise<DendaActionCandidateRow[]> {
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
                ofn.id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.nama_toko,
                t.kode_toko,
                t.cabang,
                t.nama_kontraktor,
                spk.nomor_spk,
                COALESCE(ofn.hari_denda, 0)::int AS hari_denda,
                COALESCE(ofn.nilai_denda, 0)::text AS nilai_denda,
                ofn.tanggal_akhir_spk_denda,
                ofn.tanggal_serah_terima_denda,
                latest_action.action_type AS latest_action_type,
                latest_action.status AS latest_action_status,
                latest_action.created_at AS latest_action_created_at
            FROM latest_opname ofn
            JOIN toko t ON t.id = ofn.id_toko
            LEFT JOIN LATERAL (
                SELECT nomor_spk
                FROM pengajuan_spk ps
                WHERE ps.id_toko = ofn.id_toko
                  AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                ORDER BY ps.created_at DESC NULLS LAST, ps.id DESC
                LIMIT 1
            ) spk ON TRUE
            LEFT JOIN LATERAL (
                SELECT action_type, status, created_at
                FROM denda_keterlambatan_action action
                WHERE action.id_opname_final = ofn.id
                ORDER BY action.created_at DESC, action.id DESC
                LIMIT 1
            ) latest_action ON TRUE
            WHERE UPPER(TRIM(COALESCE(t.cabang, ''))) <> 'HEAD OFFICE'
              AND COALESCE(ofn.hari_denda, 0) >= 11
            ORDER BY ofn.hari_denda DESC, ofn.tanggal_serah_terima_denda DESC NULLS LAST, ofn.id DESC
        `);

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

    async findTargetByOpnameFinalId(idOpnameFinal: number): Promise<DendaActionTargetRow | null> {
        const result = await pool.query<DendaActionTargetRow>(
            `
            SELECT
                ofn.id AS id_opname_final,
                ofn.id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                COALESCE(ofn.hari_denda, 0)::int AS hari_denda,
                COALESCE(ofn.nilai_denda, 0)::text AS nilai_denda
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE ofn.id = $1
              AND UPPER(TRIM(COALESCE(t.cabang, ''))) <> 'HEAD OFFICE'
            LIMIT 1
            `,
            [idOpnameFinal]
        );

        return result.rows[0] ?? null;
    },

    async createAction(input: {
        target: DendaActionTargetRow;
        action_type: DendaActionType;
        catatan?: string | null;
        actor_email?: string | null;
        actor_role?: string | null;
    }): Promise<DendaActionRow> {
        const result = await pool.query<DendaActionRow>(
            `
            INSERT INTO denda_keterlambatan_action (
                id_toko,
                id_opname_final,
                nomor_ulok,
                lingkup_pekerjaan,
                cabang,
                action_type,
                status,
                hari_denda,
                nilai_denda,
                catatan,
                actor_email,
                actor_role
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $10, $11)
            RETURNING ${ACTION_SELECT}
            `,
            [
                input.target.id_toko,
                input.target.id_opname_final,
                input.target.nomor_ulok,
                input.target.lingkup_pekerjaan,
                input.target.cabang,
                input.action_type,
                input.target.hari_denda,
                input.target.nilai_denda,
                input.catatan ?? null,
                input.actor_email ?? null,
                input.actor_role ?? null,
            ]
        );

        return result.rows[0];
    },
};
