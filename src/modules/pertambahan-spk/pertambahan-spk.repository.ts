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
};

const PERTAMBAHAN_SPK_COLUMNS = `
  id, id_spk, pertambahan_hari, tanggal_spk_akhir,
  tanggal_spk_akhir_setelah_perpanjangan, alasan_perpanjangan,
  dibuat_oleh, status_persetujuan, disetujui_oleh, waktu_persetujuan,
  alasan_penolakan, link_pdf, link_lampiran_pendukung, created_at
`;

export const pertambahanSpkRepository = {
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
                s.nomor_spk
            FROM pertambahan_spk p
            LEFT JOIN pengajuan_spk s ON s.id = p.id_spk
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
                s.nomor_spk
            FROM pertambahan_spk p
            LEFT JOIN pengajuan_spk s ON s.id = p.id_spk
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

        const result = await pool.query<PertambahanSpkDetailRow>(
            `
            UPDATE pertambahan_spk
            SET ${updates.join(", ")}
            WHERE id = $${values.length}
            RETURNING
                id,
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
                created_at,
                (SELECT nomor_spk FROM pengajuan_spk WHERE id = pertambahan_spk.id_spk) AS nomor_spk
            `,
            values
        );

        return result.rows[0] ?? null;
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

        const result = await pool.query<PertambahanSpkDetailRow>(
            `
            UPDATE pertambahan_spk p
            SET status_persetujuan = $1,
                disetujui_oleh = $2,
                waktu_persetujuan = $3,
                alasan_penolakan = $4
            WHERE p.id = $5
            RETURNING
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
                (SELECT nomor_spk FROM pengajuan_spk WHERE id = p.id_spk) AS nomor_spk
            `,
            [
                nextStatus,
                isApprove ? action.approver_email : null,
                isApprove ? new Date().toISOString() : null,
                isApprove ? null : (action.alasan_penolakan ?? null),
                id
            ]
        );

        return result.rows[0] ?? null;
    }
};
