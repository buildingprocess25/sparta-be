import { pool } from "../../db/pool";
import type {
    CreatePertambahanSpkInput,
    PertambahanSpkApprovalInput,
    PertambahanSpkListQuery,
    UpdatePertambahanSpkInput
} from "./pertambahan-spk.schema";

export type PertambahanSpkRow = {
    id: string;
    id_spk: string;
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
    created_at: string;
};

export type PertambahanSpkDetailRow = PertambahanSpkRow & {
    nomor_spk: string | null;
    spk: {
        id: string;
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
        status: string;
        link_pdf: string | null;
        approver_email: string | null;
        waktu_persetujuan: string | null;
        alasan_penolakan: string | null;
        created_at: string;
    } | null;
    toko: {
        id: number;
        nomor_ulok: string;
        lingkup_pekerjaan: string | null;
        nama_toko: string;
        kode_toko: string;
        proyek: string | null;
        cabang: string;
        alamat: string;
        nama_kontraktor: string | null;
    } | null;
};

const PERTAMBAHAN_SPK_COLUMNS = `
  id, id_spk, pertambahan_hari, tanggal_spk_akhir,
  tanggal_spk_akhir_setelah_perpanjangan, alasan_perpanjangan,
  dibuat_oleh, status_persetujuan, disetujui_oleh, waktu_persetujuan,
  alasan_penolakan, link_pdf, link_lampiran_pendukung, created_at
`;

const PERTAMBAHAN_SPK_DETAIL_COLUMNS = `
    p.id,
    p.id_spk,
    p.pertambahan_hari,
    p.tanggal_spk_akhir,
    p.tanggal_spk_akhir_setelah_perpanjangan,
    p.alasan_perpanjangan,
    p.dibuat_oleh,
    p.status_persetujuan,
    p.disetujui_oleh,
    p.waktu_persetujuan,
    p.alasan_penolakan,
    p.link_pdf,
    p.link_lampiran_pendukung,
    p.created_at,
    s.nomor_spk,
    CASE
        WHEN s.id IS NULL THEN NULL
        ELSE jsonb_build_object(
            'id', s.id,
            'nomor_ulok', s.nomor_ulok,
            'email_pembuat', s.email_pembuat,
            'lingkup_pekerjaan', s.lingkup_pekerjaan,
            'nama_kontraktor', s.nama_kontraktor,
            'proyek', s.proyek,
            'waktu_mulai', s.waktu_mulai,
            'durasi', s.durasi,
            'waktu_selesai', s.waktu_selesai,
            'grand_total', s.grand_total,
            'terbilang', s.terbilang,
            'nomor_spk', s.nomor_spk,
            'par', s.par,
            'spk_manual_1', s.spk_manual_1,
            'spk_manual_2', s.spk_manual_2,
            'status', s.status,
            'link_pdf', s.link_pdf,
            'approver_email', s.approver_email,
            'waktu_persetujuan', s.waktu_persetujuan,
            'alasan_penolakan', s.alasan_penolakan,
            'created_at', s.created_at
        )
    END AS spk,
    CASE
        WHEN t.id IS NULL THEN NULL
        ELSE jsonb_build_object(
            'id', t.id,
            'nomor_ulok', t.nomor_ulok,
            'lingkup_pekerjaan', t.lingkup_pekerjaan,
            'nama_toko', t.nama_toko,
            'kode_toko', t.kode_toko,
            'proyek', t.proyek,
            'cabang', t.cabang,
            'alamat', t.alamat,
            'nama_kontraktor', t.nama_kontraktor
        )
    END AS toko
`;

export const pertambahanSpkRepository = {
    async findLatestRejectedBySpkId(idSpk: number): Promise<PertambahanSpkDetailRow | null> {
        const result = await pool.query<PertambahanSpkDetailRow>(
            `
            SELECT
                ${PERTAMBAHAN_SPK_DETAIL_COLUMNS}
            FROM pertambahan_spk p
            LEFT JOIN pengajuan_spk s ON s.id = p.id_spk
            LEFT JOIN toko t ON t.nomor_ulok = s.nomor_ulok
            WHERE p.id_spk = $1
              AND p.status_persetujuan = 'Ditolak BM'
            ORDER BY p.created_at DESC
            LIMIT 1
            `,
            [idSpk]
        );

        return result.rows[0] ?? null;
    },

    async create(payload: CreatePertambahanSpkInput): Promise<PertambahanSpkRow> {
        const result = await pool.query<PertambahanSpkRow>(
            `
            INSERT INTO pertambahan_spk (
                id_spk,
                pertambahan_hari,
                tanggal_spk_akhir,
                tanggal_spk_akhir_setelah_perpanjangan,
                alasan_perpanjangan,
                dibuat_oleh,
                status_persetujuan,
                disetujui_oleh,
                waktu_persetujuan,
                alasan_penolakan,
                link_pdf,
                link_lampiran_pendukung,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING ${PERTAMBAHAN_SPK_COLUMNS}
            `,
            [
                payload.id_spk,
                payload.pertambahan_hari,
                payload.tanggal_spk_akhir,
                payload.tanggal_spk_akhir_setelah_perpanjangan,
                payload.alasan_perpanjangan,
                payload.dibuat_oleh,
                payload.status_persetujuan,
                payload.disetujui_oleh ?? null,
                payload.waktu_persetujuan ?? null,
                payload.alasan_penolakan ?? null,
                payload.link_pdf ?? null,
                payload.link_lampiran_pendukung ?? null
            ]
        );

        return result.rows[0];
    },

    async list(query: PertambahanSpkListQuery): Promise<PertambahanSpkDetailRow[]> {
        const conditions: string[] = [];
        const values: Array<string | number> = [];

        if (query.id_spk) {
            values.push(query.id_spk);
            conditions.push(`p.id_spk = $${values.length}`);
        }

        if (query.status_persetujuan) {
            values.push(query.status_persetujuan);
            conditions.push(`p.status_persetujuan = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<PertambahanSpkDetailRow>(
            `
            SELECT
                ${PERTAMBAHAN_SPK_DETAIL_COLUMNS}
            FROM pertambahan_spk p
            LEFT JOIN pengajuan_spk s ON s.id = p.id_spk
            LEFT JOIN toko t ON t.nomor_ulok = s.nomor_ulok
            ${whereClause}
            ORDER BY p.created_at DESC
            `,
            values
        );

        return result.rows;
    },

    async findById(id: string): Promise<PertambahanSpkDetailRow | null> {
        const result = await pool.query<PertambahanSpkDetailRow>(
            `
            SELECT
                ${PERTAMBAHAN_SPK_DETAIL_COLUMNS}
            FROM pertambahan_spk p
            LEFT JOIN pengajuan_spk s ON s.id = p.id_spk
            LEFT JOIN toko t ON t.nomor_ulok = s.nomor_ulok
            WHERE p.id = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async updateById(id: string, payload: UpdatePertambahanSpkInput): Promise<PertambahanSpkDetailRow | null> {
        const updates: string[] = [];
        const values: Array<string | number | null> = [];

        const setField = (field: string, value: string | number | null | undefined): void => {
            if (value !== undefined) {
                values.push(value);
                updates.push(`${field} = $${values.length}`);
            }
        };

        setField("id_spk", payload.id_spk);
        setField("pertambahan_hari", payload.pertambahan_hari);
        setField("tanggal_spk_akhir", payload.tanggal_spk_akhir);
        setField("tanggal_spk_akhir_setelah_perpanjangan", payload.tanggal_spk_akhir_setelah_perpanjangan);
        setField("alasan_perpanjangan", payload.alasan_perpanjangan);
        setField("dibuat_oleh", payload.dibuat_oleh);
        setField("status_persetujuan", payload.status_persetujuan);
        if (Object.prototype.hasOwnProperty.call(payload, "disetujui_oleh")) {
            setField("disetujui_oleh", payload.disetujui_oleh ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, "waktu_persetujuan")) {
            setField("waktu_persetujuan", payload.waktu_persetujuan ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, "alasan_penolakan")) {
            setField("alasan_penolakan", payload.alasan_penolakan ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, "link_pdf")) {
            setField("link_pdf", payload.link_pdf ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, "link_lampiran_pendukung")) {
            setField("link_lampiran_pendukung", payload.link_lampiran_pendukung ?? null);
        }

        if (updates.length === 0) {
            return this.findById(id);
        }

        values.push(id);

        const result = await pool.query<{ id: string }>(
            `
            UPDATE pertambahan_spk
            SET ${updates.join(", ")}
            WHERE id = $${values.length}
            RETURNING id
            `,
            values
        );

        if (!result.rows[0]) {
            return null;
        }

        return this.findById(id);
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM pertambahan_spk WHERE id = $1`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    },

    async applyApproval(
        id: string,
        nextStatus: string,
        action: PertambahanSpkApprovalInput
    ): Promise<PertambahanSpkDetailRow | null> {
        const isApprove = action.tindakan === "APPROVE";

        const result = await pool.query<{ id: string }>(
            `
            UPDATE pertambahan_spk p
            SET status_persetujuan = $1,
                disetujui_oleh = $2,
                waktu_persetujuan = $3,
                alasan_penolakan = $4
            WHERE p.id = $5
            RETURNING p.id
            `,
            [
                nextStatus,
                isApprove ? action.approver_email : null,
                isApprove ? new Date().toISOString() : null,
                isApprove ? null : (action.alasan_penolakan ?? null),
                id
            ]
        );

        if (!result.rows[0]) {
            return null;
        }

        return this.findById(id);
    }
};
