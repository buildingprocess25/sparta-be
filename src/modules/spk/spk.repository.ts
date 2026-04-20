import { pool, withTransaction } from "../../db/pool";
import { ACTIVE_SPK_STATUSES, type SpkStatus } from "./spk.constants";
import type { SpkApprovalInput } from "./spk.schema";

export type PengajuanSpkRow = {
    id: string;
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    lingkup_pekerjaan: string;
    nama_kontraktor: string;
    proyek: string;
    waktu_mulai: string;
    durasi: number;
    waktu_selesai: string;
    grand_total: number;
    terbilang: string;
    nomor_spk: string;
    par: string;
    spk_manual_1: string;
    spk_manual_2: string;
    status: SpkStatus;
    link_pdf: string | null;
    approver_email: string | null;
    waktu_persetujuan: string | null;
    alasan_penolakan: string | null;
    created_at: string;
};

export type SpkTokoSummary = {
    id: number | null;
    nomor_ulok: string;
    kode_toko: string | null;
    nama_toko: string | null;
    cabang: string | null;
    alamat: string | null;
};

export type SpkListRow = PengajuanSpkRow & {
    toko: SpkTokoSummary;
};

export type SpkApprovalLogRow = {
    id: string;
    pengajuan_spk_id: string;
    approver_email: string;
    tindakan: string;
    alasan_penolakan: string | null;
    waktu_tindakan: string;
};

type SpkListJoinRow = PengajuanSpkRow & {
    toko_id: number | null;
    toko_nomor_ulok: string;
    toko_kode_toko: string | null;
    toko_nama_toko: string | null;
    toko_cabang: string | null;
    toko_alamat: string | null;
};

const SPK_COLUMNS = `
    id, id_toko, nomor_ulok, email_pembuat, lingkup_pekerjaan, nama_kontraktor, proyek,
  waktu_mulai, durasi, waktu_selesai, grand_total, terbilang, nomor_spk,
  par, spk_manual_1, spk_manual_2, status, link_pdf, approver_email,
  waktu_persetujuan, alasan_penolakan, created_at
`;

export const spkRepository = {
    async findLatestByTokoId(idToko: number): Promise<PengajuanSpkRow | null> {
        const result = await pool.query<PengajuanSpkRow>(
            `
      SELECT ${SPK_COLUMNS}
      FROM pengajuan_spk
      WHERE id_toko = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async existsActiveByUlokAndLingkup(nomorUlok: string, lingkupPekerjaan: string): Promise<boolean> {
        const result = await pool.query<{ exists: boolean }>(
            `
      SELECT EXISTS(
        SELECT 1
        FROM pengajuan_spk
        WHERE nomor_ulok = $1
          AND lingkup_pekerjaan = $2
          AND status = ANY($3::text[])
      )
      `,
            [nomorUlok, lingkupPekerjaan, ACTIVE_SPK_STATUSES]
        );

        return result.rows[0]?.exists ?? false;
    },

    async getNextSequence(cabang: string, year: number, month: number): Promise<number> {
        const result = await pool.query<{ count: string }>(
            `
      SELECT COUNT(*)::text AS count
      FROM pengajuan_spk p
    JOIN toko t ON t.id = p.id_toko
      WHERE UPPER(t.cabang) = UPPER($1)
        AND EXTRACT(YEAR FROM p.created_at) = $2
        AND EXTRACT(MONTH FROM p.created_at) = $3
      `,
            [cabang, year, month]
        );

        return parseInt(result.rows[0]?.count ?? "0", 10) + 1;
    },

    async create(payload: {
        id_toko: number;
        nomor_ulok: string;
        email_pembuat: string;
        lingkup_pekerjaan: string;
        nama_kontraktor: string;
        proyek: string;
        waktu_mulai: string;
        durasi: number;
        waktu_selesai: string;
        grand_total: number;
        terbilang: string;
        nomor_spk: string;
        par: string;
        spk_manual_1: string;
        spk_manual_2: string;
        status: SpkStatus;
    }): Promise<PengajuanSpkRow> {
        const result = await pool.query<PengajuanSpkRow>(
            `
      INSERT INTO pengajuan_spk (
      id_toko, nomor_ulok, email_pembuat, lingkup_pekerjaan, nama_kontraktor, proyek,
        waktu_mulai, durasi, waktu_selesai, grand_total, terbilang, nomor_spk,
        par, spk_manual_1, spk_manual_2, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING ${SPK_COLUMNS}
      `,
            [
            payload.id_toko,
                payload.nomor_ulok,
                payload.email_pembuat,
                payload.lingkup_pekerjaan,
                payload.nama_kontraktor,
                payload.proyek,
                payload.waktu_mulai,
                payload.durasi,
                payload.waktu_selesai,
                payload.grand_total,
                payload.terbilang,
                payload.nomor_spk,
                payload.par,
                payload.spk_manual_1,
                payload.spk_manual_2,
                payload.status
            ]
        );

        return result.rows[0];
    },

    async findLatestRejectedByUlokAndLingkup(
        nomorUlok: string,
        lingkupPekerjaan: string
    ): Promise<PengajuanSpkRow | null> {
        const result = await pool.query<PengajuanSpkRow>(
            `
      SELECT ${SPK_COLUMNS}
      FROM pengajuan_spk
      WHERE nomor_ulok = $1
        AND lingkup_pekerjaan = $2
        AND status = 'SPK_REJECTED'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
            [nomorUlok, lingkupPekerjaan]
        );

        return result.rows[0] ?? null;
    },

    async resubmitRejected(
        id: string,
        payload: {
            id_toko: number;
            nomor_ulok: string;
            email_pembuat: string;
            lingkup_pekerjaan: string;
            nama_kontraktor: string;
            proyek: string;
            waktu_mulai: string;
            durasi: number;
            waktu_selesai: string;
            grand_total: number;
            terbilang: string;
            nomor_spk: string;
            par: string;
            spk_manual_1: string;
            spk_manual_2: string;
            status: SpkStatus;
        }
    ): Promise<PengajuanSpkRow> {
        const result = await pool.query<PengajuanSpkRow>(
            `
      UPDATE pengajuan_spk
      SET id_toko = $1,
          nomor_ulok = $2,
          email_pembuat = $3,
          lingkup_pekerjaan = $4,
          nama_kontraktor = $5,
          proyek = $6,
          waktu_mulai = $7,
          durasi = $8,
          waktu_selesai = $9,
          grand_total = $10,
          terbilang = $11,
          nomor_spk = $12,
          par = $13,
          spk_manual_1 = $14,
          spk_manual_2 = $15,
          status = $16,
          link_pdf = NULL,
          approver_email = NULL,
          waktu_persetujuan = NULL,
          alasan_penolakan = NULL,
          created_at = NOW()
      WHERE id = $17
      RETURNING ${SPK_COLUMNS}
      `,
            [
                payload.id_toko,
                payload.nomor_ulok,
                payload.email_pembuat,
                payload.lingkup_pekerjaan,
                payload.nama_kontraktor,
                payload.proyek,
                payload.waktu_mulai,
                payload.durasi,
                payload.waktu_selesai,
                payload.grand_total,
                payload.terbilang,
                payload.nomor_spk,
                payload.par,
                payload.spk_manual_1,
                payload.spk_manual_2,
                payload.status,
                id
            ]
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<{
        pengajuan: PengajuanSpkRow;
        approvalLogs: SpkApprovalLogRow[];
    } | null> {
        const header = await pool.query<PengajuanSpkRow>(
            `SELECT ${SPK_COLUMNS} FROM pengajuan_spk WHERE id = $1`,
            [id]
        );

        if (header.rowCount === 0) {
            return null;
        }

        const logs = await pool.query<SpkApprovalLogRow>(
            `
      SELECT id, pengajuan_spk_id, approver_email, tindakan, alasan_penolakan, waktu_tindakan
      FROM spk_approval_log
      WHERE pengajuan_spk_id = $1
      ORDER BY waktu_tindakan ASC
      `,
            [id]
        );

        return {
            pengajuan: header.rows[0],
            approvalLogs: logs.rows
        };
    },

    async list(filter: { status?: string; nomor_ulok?: string }): Promise<SpkListRow[]> {
        const conditions: string[] = [];
        const values: string[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`p.status = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`p.nomor_ulok = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<SpkListJoinRow>(
            `
          SELECT p.id, p.id_toko, p.nomor_ulok, p.email_pembuat, p.lingkup_pekerjaan, p.nama_kontraktor, p.proyek,
                p.waktu_mulai, p.durasi, p.waktu_selesai, p.grand_total, p.terbilang, p.nomor_spk,
                p.par, p.spk_manual_1, p.spk_manual_2, p.status, p.link_pdf, p.approver_email,
                p.waktu_persetujuan, p.alasan_penolakan, p.created_at,
        t.id AS toko_id,
        t.nomor_ulok AS toko_nomor_ulok,
        t.kode_toko AS toko_kode_toko,
        t.nama_toko AS toko_nama_toko,
        t.cabang AS toko_cabang,
        t.alamat AS toko_alamat
      FROM pengajuan_spk p
        LEFT JOIN toko t ON t.id = p.id_toko
      ${whereClause}
      ORDER BY p.created_at DESC
      `,
            values
        );

        return result.rows.map((row: SpkListJoinRow): SpkListRow => {
            const {
                toko_id,
                toko_nomor_ulok,
                toko_kode_toko,
                toko_nama_toko,
                toko_cabang,
                toko_alamat,
                ...spk
            } = row;

            return {
                ...spk,
                toko: {
                    id: toko_id,
                    nomor_ulok: toko_nomor_ulok ?? spk.nomor_ulok,
                    kode_toko: toko_kode_toko,
                    nama_toko: toko_nama_toko,
                    cabang: toko_cabang,
                    alamat: toko_alamat
                }
            };
        });
    },

    async updateStatusAndInsertLog(
        pengajuanSpkId: string,
        newStatus: SpkStatus,
        action: SpkApprovalInput
    ): Promise<void> {
        await withTransaction(async (client) => {
            if (action.tindakan === "APPROVE") {
                await client.query(
                    `
          UPDATE pengajuan_spk
          SET status = $1,
              approver_email = $2,
              waktu_persetujuan = NOW()
          WHERE id = $3
          `,
                    [newStatus, action.approver_email, pengajuanSpkId]
                );
            } else {
                await client.query(
                    `
          UPDATE pengajuan_spk
          SET status = $1,
              alasan_penolakan = $2
          WHERE id = $3
          `,
                    [newStatus, action.alasan_penolakan ?? null, pengajuanSpkId]
                );
            }

            await client.query(
                `
        INSERT INTO spk_approval_log (
          pengajuan_spk_id, approver_email, tindakan, alasan_penolakan, waktu_tindakan
        ) VALUES ($1, $2, $3, $4, NOW())
        `,
                [
                    pengajuanSpkId,
                    action.approver_email,
                    action.tindakan,
                    action.alasan_penolakan ?? null
                ]
            );
        });
    },

    async updatePdfLink(
        pengajuanSpkId: string,
        linkPdf: string
    ): Promise<void> {
        await pool.query(
            `
      UPDATE pengajuan_spk
      SET link_pdf = $1
      WHERE id = $2
      `,
            [linkPdf, pengajuanSpkId]
        );
    },

    async deleteById(id: string): Promise<void> {
        await pool.query(`DELETE FROM pengajuan_spk WHERE id = $1`, [id]);
    }
};
