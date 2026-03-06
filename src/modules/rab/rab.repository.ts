import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { ACTIVE_RAB_STATUSES, type RabStatus } from "./rab.constants";
import type { DetailItemInput } from "./rab.schema";

export type PengajuanRabRow = {
    id: string;
    nomor_ulok: string;
    email_pembuat: string;
    nama_pt: string;
    lingkup_pekerjaan: string;
    durasi_pekerjaan: string;
    status: RabStatus;
    grand_total_nonsbo: number;
    grand_total_final: number;
    link_pdf_gabungan: string | null;
    created_at: string;
};

export type DetailItemRow = {
    id: string;
    pengajuan_rab_id: string;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
};

export type ApprovalLogRow = {
    id: string;
    pengajuan_rab_id: string;
    approver_email: string;
    jabatan: string;
    tindakan: string;
    alasan_penolakan: string | null;
    waktu_tindakan: string;
};

const insertDetailItems = async (
    client: PoolClient,
    pengajuanRabId: string,
    detailItems: DetailItemInput[]
): Promise<void> => {
    for (const item of detailItems) {
        await client.query(
            `
      INSERT INTO detail_item_rab (
        pengajuan_rab_id, kategori_pekerjaan, jenis_pekerjaan, satuan, volume, harga_material, harga_upah
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
            [
                pengajuanRabId,
                item.kategori_pekerjaan,
                item.jenis_pekerjaan,
                item.satuan,
                item.volume,
                item.harga_material,
                item.harga_upah
            ]
        );
    }
};

export const rabRepository = {
    async existsActiveByUlokAndLingkup(nomorUlok: string, lingkupPekerjaan: string): Promise<boolean> {
        const result = await pool.query<{ exists: boolean }>(
            `
      SELECT EXISTS(
        SELECT 1
        FROM pengajuan_rab
        WHERE nomor_ulok = $1
          AND lingkup_pekerjaan = $2
          AND status = ANY($3::text[])
      )
      `,
            [nomorUlok, lingkupPekerjaan, ACTIVE_RAB_STATUSES]
        );

        return result.rows[0]?.exists ?? false;
    },

    async createWithDetails(payload: {
        nomor_ulok: string;
        email_pembuat: string;
        nama_pt: string;
        lingkup_pekerjaan: string;
        durasi_pekerjaan: string;
        status: RabStatus;
        grand_total_nonsbo: number;
        grand_total_final: number;
        link_pdf_gabungan?: string;
        detail_items: DetailItemInput[];
    }): Promise<PengajuanRabRow> {
        return withTransaction(async (client) => {
            const headerResult = await client.query<PengajuanRabRow>(
                `
        INSERT INTO pengajuan_rab (
          nomor_ulok,
          email_pembuat,
          nama_pt,
          lingkup_pekerjaan,
          durasi_pekerjaan,
          status,
          grand_total_nonsbo,
          grand_total_final,
          link_pdf_gabungan,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, nomor_ulok, email_pembuat, nama_pt, lingkup_pekerjaan, durasi_pekerjaan,
          status, grand_total_nonsbo, grand_total_final, link_pdf_gabungan, created_at
        `,
                [
                    payload.nomor_ulok,
                    payload.email_pembuat,
                    payload.nama_pt,
                    payload.lingkup_pekerjaan,
                    payload.durasi_pekerjaan,
                    payload.status,
                    payload.grand_total_nonsbo,
                    payload.grand_total_final,
                    payload.link_pdf_gabungan ?? null
                ]
            );

            const pengajuan = headerResult.rows[0];
            await insertDetailItems(client, pengajuan.id, payload.detail_items);
            return pengajuan;
        });
    },

    async findById(id: string): Promise<{
        pengajuan: PengajuanRabRow;
        detailItems: DetailItemRow[];
        approvalLogs: ApprovalLogRow[];
    } | null> {
        const header = await pool.query<PengajuanRabRow>(
            `
      SELECT id, nomor_ulok, email_pembuat, nama_pt, lingkup_pekerjaan, durasi_pekerjaan,
        status, grand_total_nonsbo, grand_total_final, link_pdf_gabungan, created_at
      FROM pengajuan_rab
      WHERE id = $1
      `,
            [id]
        );

        if (header.rowCount === 0) {
            return null;
        }

        const detail = await pool.query<DetailItemRow>(
            `
      SELECT id, pengajuan_rab_id, kategori_pekerjaan, jenis_pekerjaan, satuan, volume, harga_material, harga_upah
      FROM detail_item_rab
      WHERE pengajuan_rab_id = $1
      ORDER BY id ASC
      `,
            [id]
        );

        const logs = await pool.query<ApprovalLogRow>(
            `
      SELECT id, pengajuan_rab_id, approver_email, jabatan, tindakan, alasan_penolakan, waktu_tindakan
      FROM approval_log
      WHERE pengajuan_rab_id = $1
      ORDER BY waktu_tindakan ASC
      `,
            [id]
        );

        return {
            pengajuan: header.rows[0],
            detailItems: detail.rows,
            approvalLogs: logs.rows
        };
    },

    async list(filter: { status?: string; nomor_ulok?: string }): Promise<PengajuanRabRow[]> {
        const conditions: string[] = [];
        const values: string[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`status = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`nomor_ulok = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<PengajuanRabRow>(
            `
      SELECT id, nomor_ulok, email_pembuat, nama_pt, lingkup_pekerjaan, durasi_pekerjaan,
        status, grand_total_nonsbo, grand_total_final, link_pdf_gabungan, created_at
      FROM pengajuan_rab
      ${whereClause}
      ORDER BY created_at DESC
      `,
            values
        );

        return result.rows;
    },

    async updateStatusAndInsertLog(
        pengajuanRabId: string,
        newStatus: RabStatus,
        action: ApprovalActionInput
    ): Promise<void> {
        await withTransaction(async (client) => {
            await client.query(
                `
        UPDATE pengajuan_rab
        SET status = $1
        WHERE id = $2
        `,
                [newStatus, pengajuanRabId]
            );

            await client.query(
                `
        INSERT INTO approval_log (
          pengajuan_rab_id,
          approver_email,
          jabatan,
          tindakan,
          alasan_penolakan,
          waktu_tindakan
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        `,
                [
                    pengajuanRabId,
                    action.approver_email,
                    action.jabatan,
                    action.tindakan,
                    action.alasan_penolakan ?? null
                ]
            );
        });
    }
};
