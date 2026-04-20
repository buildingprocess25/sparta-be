import { pool, withTransaction } from "../../db/pool";
import type { ApprovalActionInput } from "../approval/approval.schema";
import type { OpnameFinalStatus } from "./opname-final.constants";
import type { LockOpnameFinalInput, OpnameFinalListQueryInput } from "./opname-final.schema";

export type OpnameFinalRow = {
    id: number;
    id_toko: number;
    status_opname_final: OpnameFinalStatus;
    link_pdf_opname: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    alasan_penolakan: string | null;
    grand_total_opname: string | null;
    grand_total_rab: string | null;
    created_at: string;
};

export type OpnameFinalListRow = OpnameFinalRow & {
    nomor_ulok: string;
    nama_toko: string | null;
    proyek: string | null;
    cabang: string | null;
};

export type OpnameFinalItemRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    id_rab_item: number;
    status: "pending" | "disetujui" | "ditolak";
    volume_akhir: number;
    selisih_volume: number;
    total_selisih: number;
    desain: string | null;
    kualitas: string | null;
    spesifikasi: string | null;
    foto: string | null;
    catatan: string | null;
    created_at: string;
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    volume_rab: number | null;
    total_harga_rab: number | null;
};

export type OpnameFinalDetail = {
    opname_final: OpnameFinalRow;
    toko: {
        id: number;
        nomor_ulok: string;
        nama_toko: string | null;
        proyek: string | null;
        cabang: string | null;
        alamat: string | null;
        lingkup_pekerjaan: string | null;
    };
    items: OpnameFinalItemRow[];
};

const OPNAME_FINAL_COLUMNS = `
    ofn.id,
    ofn.id_toko,
    ofn.status_opname_final,
    ofn.link_pdf_opname,
    ofn.email_pembuat,
    ofn.pemberi_persetujuan_direktur,
    ofn.waktu_persetujuan_direktur,
    ofn.pemberi_persetujuan_koordinator,
    ofn.waktu_persetujuan_koordinator,
    ofn.pemberi_persetujuan_manager,
    ofn.waktu_persetujuan_manager,
    ofn.alasan_penolakan,
    ofn.grand_total_opname,
    ofn.grand_total_rab,
    ofn.created_at
`;

const approvalTimestampExpression = "to_char(timezone('Asia/Jakarta', now()), 'YYYY-MM-DD HH24:MI:SS')";

export const opnameFinalRepository = {
    async list(filter: OpnameFinalListQueryInput): Promise<OpnameFinalListRow[]> {
        const conditions: string[] = [];
        const values: Array<string | number> = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`ofn.status_opname_final = $${values.length}`);
        }

        if (typeof filter.id_toko !== "undefined") {
            values.push(filter.id_toko);
            conditions.push(`ofn.id_toko = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`t.nomor_ulok = $${values.length}`);
        }

        if (filter.cabang) {
            values.push(filter.cabang);
            conditions.push(`t.cabang = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<OpnameFinalListRow>(
            `
            SELECT ${OPNAME_FINAL_COLUMNS},
                t.nomor_ulok,
                t.nama_toko,
                t.proyek,
                t.cabang
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            ${whereClause}
            ORDER BY ofn.created_at DESC, ofn.id DESC
            `,
            values
        );

        return result.rows;
    },

    async findById(id: string): Promise<OpnameFinalDetail | null> {
        const headerResult = await pool.query<OpnameFinalRow & {
            nomor_ulok: string;
            nama_toko: string | null;
            proyek: string | null;
            cabang: string | null;
            alamat: string | null;
            lingkup_pekerjaan: string | null;
        }>(
            `
            SELECT ${OPNAME_FINAL_COLUMNS},
                t.nomor_ulok,
                t.nama_toko,
                t.proyek,
                t.cabang,
                t.alamat,
                t.lingkup_pekerjaan
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE ofn.id = $1
            `,
            [id]
        );

        if ((headerResult.rowCount ?? 0) === 0) {
            return null;
        }

        const header = headerResult.rows[0];

        const itemsResult = await pool.query<OpnameFinalItemRow>(
            `
            SELECT
                oi.id,
                oi.id_toko,
                oi.id_opname_final,
                oi.id_rab_item,
                oi.status,
                oi.volume_akhir,
                oi.selisih_volume,
                oi.total_selisih,
                oi.desain,
                oi.kualitas,
                oi.spesifikasi,
                oi.foto,
                oi.catatan,
                oi.created_at,
                ri.kategori_pekerjaan,
                ri.jenis_pekerjaan,
                ri.satuan,
                ri.volume AS volume_rab,
                ri.total_harga AS total_harga_rab
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            WHERE oi.id_opname_final = $1
            ORDER BY oi.id ASC
            `,
            [id]
        );

        return {
            opname_final: {
                id: header.id,
                id_toko: header.id_toko,
                status_opname_final: header.status_opname_final,
                link_pdf_opname: header.link_pdf_opname,
                email_pembuat: header.email_pembuat,
                pemberi_persetujuan_direktur: header.pemberi_persetujuan_direktur,
                waktu_persetujuan_direktur: header.waktu_persetujuan_direktur,
                pemberi_persetujuan_koordinator: header.pemberi_persetujuan_koordinator,
                waktu_persetujuan_koordinator: header.waktu_persetujuan_koordinator,
                pemberi_persetujuan_manager: header.pemberi_persetujuan_manager,
                waktu_persetujuan_manager: header.waktu_persetujuan_manager,
                alasan_penolakan: header.alasan_penolakan,
                grand_total_opname: header.grand_total_opname,
                grand_total_rab: header.grand_total_rab,
                created_at: header.created_at
            },
            toko: {
                id: header.id_toko,
                nomor_ulok: header.nomor_ulok,
                nama_toko: header.nama_toko,
                proyek: header.proyek,
                cabang: header.cabang,
                alamat: header.alamat,
                lingkup_pekerjaan: header.lingkup_pekerjaan
            },
            items: itemsResult.rows
        };
    },

    async updateApproval(
        opnameFinalId: string,
        newStatus: OpnameFinalStatus,
        action: ApprovalActionInput
    ): Promise<void> {
        if (action.tindakan === "APPROVE") {
            const sets: string[] = ["status_opname_final = $1", "alasan_penolakan = NULL"];
            const values: Array<string> = [newStatus];

            if (action.jabatan === "KOORDINATOR") {
                values.push(action.approver_email);
                sets.push(`pemberi_persetujuan_koordinator = $${values.length}`);
                sets.push(`waktu_persetujuan_koordinator = ${approvalTimestampExpression}`);
            } else if (action.jabatan === "MANAGER") {
                values.push(action.approver_email);
                sets.push(`pemberi_persetujuan_manager = $${values.length}`);
                sets.push(`waktu_persetujuan_manager = ${approvalTimestampExpression}`);
            } else {
                values.push(action.approver_email);
                sets.push(`pemberi_persetujuan_direktur = $${values.length}`);
                sets.push(`waktu_persetujuan_direktur = ${approvalTimestampExpression}`);
            }

            values.push(opnameFinalId);
            await pool.query(
                `UPDATE opname_final SET ${sets.join(", ")} WHERE id = $${values.length}`,
                values
            );
            return;
        }

        await pool.query(
            `
            UPDATE opname_final
            SET status_opname_final = $1,
                alasan_penolakan = $2
            WHERE id = $3
            `,
            [newStatus, action.alasan_penolakan?.trim() ?? null, opnameFinalId]
        );
    },

    async updatePdfLink(opnameFinalId: string, linkPdf: string): Promise<void> {
        await pool.query(
            `UPDATE opname_final SET link_pdf_opname = $1 WHERE id = $2`,
            [linkPdf, opnameFinalId]
        );
    },

    async updateTotals(opnameFinalId: string): Promise<void> {
        const totals = await pool.query<{ grand_total_opname: string; grand_total_rab: string }>(
            `
            SELECT
                COALESCE(SUM(oi.total_selisih), 0)::text AS grand_total_opname,
                COALESCE(SUM(ri.total_harga), 0)::text AS grand_total_rab
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            WHERE oi.id_opname_final = $1
            `,
            [opnameFinalId]
        );

        await pool.query(
            `
            UPDATE opname_final
            SET grand_total_opname = $1,
                grand_total_rab = $2
            WHERE id = $3
            `,
            [
                totals.rows[0]?.grand_total_opname ?? "0",
                totals.rows[0]?.grand_total_rab ?? "0",
                opnameFinalId
            ]
        );
    },

    async lockById(opnameFinalId: string, payload: LockOpnameFinalInput): Promise<{ item_count: number }> {
        return withTransaction(async (client) => {
            const existing = await client.query<{ id: number }>(
                `SELECT id FROM opname_final WHERE id = $1 FOR UPDATE`,
                [opnameFinalId]
            );

            if ((existing.rowCount ?? 0) === 0) {
                return { item_count: 0 };
            }

            await client.query(
                `DELETE FROM opname_item WHERE id_opname_final = $1`,
                [opnameFinalId]
            );

            const values: Array<number | string | null> = [];
            const placeholders = payload.opname_item.map((item, index) => {
                const base = index * 12;
                values.push(
                    payload.id_toko,
                    Number(opnameFinalId),
                    item.id_rab_item,
                    item.status ?? "pending",
                    item.volume_akhir,
                    item.selisih_volume,
                    item.total_selisih,
                    item.desain ?? null,
                    item.kualitas ?? null,
                    item.spesifikasi ?? null,
                    item.foto ?? null,
                    item.catatan ?? null
                );

                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
            });

            await client.query(
                `
                INSERT INTO opname_item (
                    id_toko,
                    id_opname_final,
                    id_rab_item,
                    status,
                    volume_akhir,
                    selisih_volume,
                    total_selisih,
                    desain,
                    kualitas,
                    spesifikasi,
                    foto,
                    catatan
                )
                VALUES ${placeholders.join(", ")}
                `,
                values
            );

            await client.query(
                `
                UPDATE opname_final
                SET id_toko = $1,
                    email_pembuat = $2,
                    grand_total_opname = $3,
                    grand_total_rab = $4,
                    status_opname_final = $5,
                    alasan_penolakan = NULL,
                    pemberi_persetujuan_direktur = $2,
                    waktu_persetujuan_direktur = ${approvalTimestampExpression},
                    pemberi_persetujuan_koordinator = NULL,
                    waktu_persetujuan_koordinator = NULL,
                    pemberi_persetujuan_manager = NULL,
                    waktu_persetujuan_manager = NULL
                WHERE id = $6
                `,
                [
                    payload.id_toko,
                    payload.email_pembuat,
                    payload.grand_total_opname,
                    payload.grand_total_rab,
                    "Menunggu Persetujuan Koordinator",
                    opnameFinalId
                ]
            );

            return { item_count: payload.opname_item.length };
        });
    }
};
