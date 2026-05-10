import { pool, withTransaction } from "../../db/pool";
import type { PoolClient } from "pg";
import type { PpStatus, PpRole, PpAksi } from "./projek-planning.constants";
import type {
    SubmitProjekPlanningInput,
    ApprovalInput,
    PpApproval1Input,
    Upload3dInput,
    UploadRabInput,
    ListProjekPlanningQuery,
    ResubmitProjekPlanningInput,
} from "./projek-planning.schema";

// ============================================================
// ROW TYPES
// ============================================================

export type ProjekPlanningRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    proyek: string | null;
    lingkup_pekerjaan: string | null;
    jenis_proyek: string | null;
    estimasi_biaya: string | null;
    keterangan: string | null;

    // Identitas Pengajuan
    nama_pengaju: string | null;
    nama_lokasi: string | null;

    // Jenis Pengajuan Design
    jenis_pengajuan: string | null;
    jenis_pengajuan_lainnya: string | null;

    // Fasilitas
    fasilitas_air_bersih: boolean;
    fasilitas_air_bersih_keterangan: string | null;
    fasilitas_drain: boolean;
    fasilitas_drain_keterangan: string | null;
    fasilitas_ac: boolean;
    fasilitas_ac_keterangan: string | null;
    fasilitas_lainnya: string | null;
    fasilitas_lainnya_keterangan: string | null;

    // Ketentuan
    ketentuan_1: string | null;
    ketentuan_2: string | null;
    ketentuan_3: string | null;
    ketentuan_4: string | null;
    ketentuan_5: string | null;

    // Catatan Design
    catatan_design_1: string | null;
    catatan_design_2: string | null;
    catatan_design_3: string | null;
    catatan_design_4: string | null;
    catatan_design_5: string | null;

    // Links
    link_fpd: string | null;
    link_rab: string | null;
    link_gambar_kerja: string | null;
    link_desain_3d: string | null;
    link_fpd_approved: string | null;
    link_gambar_rab_sipil: string | null;
    link_gambar_rab_me: string | null;

    // Status & flags
    status: PpStatus;
    butuh_desain_3d: boolean;

    // Approval fields
    bm_approver_email: string | null;
    bm_waktu_persetujuan: string | null;
    bm_alasan_penolakan: string | null;
    pp1_approver_email: string | null;
    pp1_waktu_persetujuan: string | null;
    pp1_alasan_penolakan: string | null;
    pp_manager_approver_email: string | null;
    pp_manager_waktu_persetujuan: string | null;
    pp_manager_alasan_penolakan: string | null;
    pp2_approver_email: string | null;
    pp2_waktu_persetujuan: string | null;
    pp2_alasan_penolakan: string | null;

    created_at: string;
    updated_at: string;
};

export type ProjekPlanningLogRow = {
    id: number;
    projek_planning_id: number;
    actor_email: string;
    role: PpRole;
    aksi: PpAksi;
    status_sebelum: string | null;
    status_sesudah: string | null;
    alasan_penolakan: string | null;
    keterangan: string | null;
    created_at: string;
};

// ============================================================
// COLUMNS
// ============================================================

const PP_COLUMNS = `
    id, id_toko, nomor_ulok, email_pembuat,
    nama_toko, kode_toko, cabang, proyek, lingkup_pekerjaan,
    jenis_proyek, estimasi_biaya, keterangan,
    nama_pengaju, nama_lokasi,
    jenis_pengajuan, jenis_pengajuan_lainnya,
    fasilitas_air_bersih, fasilitas_air_bersih_keterangan,
    fasilitas_drain, fasilitas_drain_keterangan,
    fasilitas_ac, fasilitas_ac_keterangan,
    fasilitas_lainnya, fasilitas_lainnya_keterangan,
    ketentuan_1, ketentuan_2, ketentuan_3, ketentuan_4, ketentuan_5,
    catatan_design_1, catatan_design_2, catatan_design_3, catatan_design_4, catatan_design_5,
    link_fpd, link_rab, link_gambar_kerja, link_desain_3d, link_fpd_approved,
    link_gambar_rab_sipil, link_gambar_rab_me,
    status, butuh_desain_3d,
    bm_approver_email, bm_waktu_persetujuan, bm_alasan_penolakan,
    pp1_approver_email, pp1_waktu_persetujuan, pp1_alasan_penolakan,
    pp_manager_approver_email, pp_manager_waktu_persetujuan, pp_manager_alasan_penolakan,
    pp2_approver_email, pp2_waktu_persetujuan, pp2_alasan_penolakan,
    created_at, updated_at
`;

// ============================================================
// REPOSITORY
// ============================================================

export const projekPlanningRepository = {

    // ----------------------------------------------------------
    // FIND
    // ----------------------------------------------------------

    async findById(id: number): Promise<{
        projek: ProjekPlanningRow;
        logs: ProjekPlanningLogRow[];
    } | null> {
        const headerResult = await pool.query<ProjekPlanningRow>(
            `SELECT ${PP_COLUMNS} FROM projek_planning WHERE id = $1`,
            [id]
        );

        if ((headerResult.rowCount ?? 0) === 0) return null;

        const logsResult = await pool.query<ProjekPlanningLogRow>(
            `SELECT id, projek_planning_id, actor_email, role, aksi,
                    status_sebelum, status_sesudah, alasan_penolakan, keterangan, created_at
             FROM projek_planning_log
             WHERE projek_planning_id = $1
             ORDER BY created_at ASC`,
            [id]
        );

        return {
            projek: headerResult.rows[0],
            logs: logsResult.rows,
        };
    },

    async findActiveByTokoId(idToko: number): Promise<ProjekPlanningRow | null> {
        const result = await pool.query<ProjekPlanningRow>(
            `SELECT ${PP_COLUMNS}
             FROM projek_planning
             WHERE id_toko = $1
               AND status NOT IN ('COMPLETED', 'REJECTED', 'DRAFT')
             ORDER BY created_at DESC
             LIMIT 1`,
            [idToko]
        );
        return result.rows[0] ?? null;
    },

    async findDraftByTokoId(idToko: number): Promise<ProjekPlanningRow | null> {
        const result = await pool.query<ProjekPlanningRow>(
            `SELECT ${PP_COLUMNS}
             FROM projek_planning
             WHERE id_toko = $1
               AND status = 'DRAFT'
             ORDER BY created_at DESC
             LIMIT 1`,
            [idToko]
        );
        return result.rows[0] ?? null;
    },

    async findLatestByTokoId(idToko: number): Promise<ProjekPlanningRow | null> {
        const result = await pool.query<ProjekPlanningRow>(
            `SELECT ${PP_COLUMNS}
             FROM projek_planning
             WHERE id_toko = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [idToko]
        );
        return result.rows[0] ?? null;
    },

    async list(filter: ListProjekPlanningQuery): Promise<ProjekPlanningRow[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`status = $${values.length}`);
        }
        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`nomor_ulok = $${values.length}`);
        }
        if (filter.cabang) {
            values.push(`%${filter.cabang}%`);
            conditions.push(`cabang ILIKE $${values.length}`);
        }
        if (filter.email_pembuat) {
            values.push(filter.email_pembuat);
            conditions.push(`email_pembuat = $${values.length}`);
        }
        if (filter.id_toko) {
            values.push(filter.id_toko);
            conditions.push(`id_toko = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<ProjekPlanningRow>(
            `SELECT ${PP_COLUMNS}
             FROM projek_planning
             ${whereClause}
             ORDER BY created_at DESC`,
            values
        );

        return result.rows;
    },

    // ----------------------------------------------------------
    // CREATE
    // ----------------------------------------------------------

    async create(payload: SubmitProjekPlanningInput & {
        nama_toko: string | null;
        kode_toko: string | null;
        cabang: string | null;
        proyek: string | null;
        status: PpStatus;
    }): Promise<ProjekPlanningRow> {
        const result = await pool.query<ProjekPlanningRow>(
            `INSERT INTO projek_planning (
                id_toko, nomor_ulok, email_pembuat,
                nama_toko, kode_toko, cabang, proyek, lingkup_pekerjaan,
                jenis_proyek, estimasi_biaya, keterangan, link_fpd,
                nama_pengaju, nama_lokasi,
                jenis_pengajuan, jenis_pengajuan_lainnya,
                fasilitas_air_bersih, fasilitas_air_bersih_keterangan,
                fasilitas_drain, fasilitas_drain_keterangan,
                fasilitas_ac, fasilitas_ac_keterangan,
                fasilitas_lainnya, fasilitas_lainnya_keterangan,
                ketentuan_1, ketentuan_2, ketentuan_3, ketentuan_4, ketentuan_5,
                catatan_design_1, catatan_design_2, catatan_design_3, catatan_design_4, catatan_design_5,
                link_gambar_rab_sipil, link_gambar_rab_me,
                status, butuh_desain_3d,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3,
                $4, $5, $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14,
                $15, $16,
                $17, $18,
                $19, $20,
                $21, $22,
                $23, $24,
                $25, $26, $27, $28, $29,
                $30, $31, $32, $33, $34,
                $35, $36,
                $37, FALSE,
                NOW(), NOW()
            )
            RETURNING ${PP_COLUMNS}`,
            [
                payload.id_toko,
                payload.nomor_ulok,
                payload.email_pembuat,
                payload.nama_toko,
                payload.kode_toko,
                payload.cabang,
                payload.proyek,
                payload.lingkup_pekerjaan,
                payload.jenis_proyek,
                payload.estimasi_biaya ?? null,
                payload.keterangan ?? null,
                payload.link_fpd ?? null,
                payload.nama_pengaju,
                payload.nama_lokasi,
                payload.jenis_pengajuan,
                payload.jenis_pengajuan_lainnya ?? null,
                payload.fasilitas_air_bersih ?? false,
                payload.fasilitas_air_bersih_keterangan ?? null,
                payload.fasilitas_drain ?? false,
                payload.fasilitas_drain_keterangan ?? null,
                payload.fasilitas_ac ?? false,
                payload.fasilitas_ac_keterangan ?? null,
                payload.fasilitas_lainnya ?? null,
                payload.fasilitas_lainnya_keterangan ?? null,
                payload.ketentuan_1 ?? null,
                payload.ketentuan_2 ?? null,
                payload.ketentuan_3 ?? null,
                payload.ketentuan_4 ?? null,
                payload.ketentuan_5 ?? null,
                payload.catatan_design_1 ?? null,
                payload.catatan_design_2 ?? null,
                payload.catatan_design_3 ?? null,
                payload.catatan_design_4 ?? null,
                payload.catatan_design_5 ?? null,
                payload.link_gambar_rab_sipil ?? null,
                payload.link_gambar_rab_me ?? null,
                payload.status,
            ]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // RESUBMIT (update existing DRAFT record, dipakai saat coordinator submit ulang)
    // ----------------------------------------------------------

    async resubmitDraft(id: number, payload: ResubmitProjekPlanningInput & {
        nama_toko: string | null;
        kode_toko: string | null;
        cabang: string | null;
        proyek: string | null;
        status: PpStatus;
    }): Promise<ProjekPlanningRow> {
        const result = await pool.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET email_pembuat = $1,
                 lingkup_pekerjaan = $2,
                 jenis_proyek = $3,
                 estimasi_biaya = $4,
                 keterangan = $5,
                 link_fpd = COALESCE($6, link_fpd),
                 nama_toko = $7,
                 kode_toko = $8,
                 cabang = $9,
                 proyek = $10,
                 nama_pengaju = $11,
                 nama_lokasi = $12,
                 jenis_pengajuan = $13,
                 jenis_pengajuan_lainnya = $14,
                 fasilitas_air_bersih = $15,
                 fasilitas_air_bersih_keterangan = $16,
                 fasilitas_drain = $17,
                 fasilitas_drain_keterangan = $18,
                 fasilitas_ac = $19,
                 fasilitas_ac_keterangan = $20,
                 fasilitas_lainnya = $21,
                 fasilitas_lainnya_keterangan = $22,
                 ketentuan_1 = $23,
                 ketentuan_2 = $24,
                 ketentuan_3 = $25,
                 ketentuan_4 = $26,
                 ketentuan_5 = $27,
                 catatan_design_1 = $28,
                 catatan_design_2 = $29,
                 catatan_design_3 = $30,
                 catatan_design_4 = $31,
                 catatan_design_5 = $32,
                 link_gambar_rab_sipil = $33,
                 link_gambar_rab_me = $34,
                 status = $35,
                 butuh_desain_3d = FALSE,
                 bm_approver_email = NULL,
                 bm_waktu_persetujuan = NULL,
                 bm_alasan_penolakan = NULL,
                 pp1_approver_email = NULL,
                 pp1_waktu_persetujuan = NULL,
                 pp1_alasan_penolakan = NULL,
                 pp_manager_approver_email = NULL,
                 pp_manager_waktu_persetujuan = NULL,
                 pp_manager_alasan_penolakan = NULL,
                 pp2_approver_email = NULL,
                 pp2_waktu_persetujuan = NULL,
                 pp2_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $36
             RETURNING ${PP_COLUMNS}`,
            [
                payload.email_pembuat,
                payload.lingkup_pekerjaan,
                payload.jenis_proyek,
                payload.estimasi_biaya ?? null,
                payload.keterangan ?? null,
                payload.link_fpd ?? null,
                payload.nama_toko,
                payload.kode_toko,
                payload.cabang,
                payload.proyek,
                payload.nama_pengaju,
                payload.nama_lokasi,
                payload.jenis_pengajuan,
                payload.jenis_pengajuan_lainnya ?? null,
                payload.fasilitas_air_bersih ?? false,
                payload.fasilitas_air_bersih_keterangan ?? null,
                payload.fasilitas_drain ?? false,
                payload.fasilitas_drain_keterangan ?? null,
                payload.fasilitas_ac ?? false,
                payload.fasilitas_ac_keterangan ?? null,
                payload.fasilitas_lainnya ?? null,
                payload.fasilitas_lainnya_keterangan ?? null,
                payload.ketentuan_1 ?? null,
                payload.ketentuan_2 ?? null,
                payload.ketentuan_3 ?? null,
                payload.ketentuan_4 ?? null,
                payload.ketentuan_5 ?? null,
                payload.catatan_design_1 ?? null,
                payload.catatan_design_2 ?? null,
                payload.catatan_design_3 ?? null,
                payload.catatan_design_4 ?? null,
                payload.catatan_design_5 ?? null,
                payload.link_gambar_rab_sipil ?? null,
                payload.link_gambar_rab_me ?? null,
                payload.status,
                id,
            ]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // RESET ke DRAFT (saat ditolak di tahap manapun)
    // Mendukung PoolClient untuk digunakan dalam transaksi
    // ----------------------------------------------------------

    async resetToDraft(id: number, client?: PoolClient): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = 'DRAFT',
                 butuh_desain_3d = FALSE,
                 bm_approver_email = NULL,
                 bm_waktu_persetujuan = NULL,
                 bm_alasan_penolakan = NULL,
                 pp1_approver_email = NULL,
                 pp1_waktu_persetujuan = NULL,
                 pp1_alasan_penolakan = NULL,
                 pp_manager_approver_email = NULL,
                 pp_manager_waktu_persetujuan = NULL,
                 pp_manager_alasan_penolakan = NULL,
                 pp2_approver_email = NULL,
                 pp2_waktu_persetujuan = NULL,
                 pp2_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING ${PP_COLUMNS}`,
            [id]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // RESET ke RAB UPLOAD (saat ditolak oleh PP Manager)
    // ----------------------------------------------------------

    async resetToRabUpload(id: number, client?: PoolClient): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = 'WAITING_RAB_UPLOAD',
                 pp_manager_approver_email = NULL,
                 pp_manager_waktu_persetujuan = NULL,
                 pp_manager_alasan_penolakan = NULL,
                 pp2_approver_email = NULL,
                 pp2_waktu_persetujuan = NULL,
                 pp2_alasan_penolakan = NULL,
                 link_rab = NULL,
                 link_gambar_kerja = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING ${PP_COLUMNS}`,
            [id]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // UPDATE STATUS + kolom approval spesifik (per tahap — hanya untuk APPROVE)
    // ----------------------------------------------------------

    async updateStatusAndBmApproval(
        id: number,
        newStatus: PpStatus,
        action: ApprovalInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 bm_approver_email = $2,
                 bm_waktu_persetujuan = NOW(),
                 bm_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING ${PP_COLUMNS}`,
            [newStatus, action.approver_email, id]
        );
        return result.rows[0];
    },

    async updateStatusAndPp1Approval(
        id: number,
        newStatus: PpStatus,
        action: PpApproval1Input,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 butuh_desain_3d = $2,
                 pp1_approver_email = $3,
                 pp1_waktu_persetujuan = NOW(),
                 pp1_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING ${PP_COLUMNS}`,
            [newStatus, action.butuh_desain_3d ?? false, action.approver_email, id]
        );
        return result.rows[0];
    },

    async updateDesain3d(
        id: number,
        newStatus: PpStatus,
        payload: Upload3dInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 link_desain_3d = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING ${PP_COLUMNS}`,
            [newStatus, payload.link_desain_3d, id]
        );
        return result.rows[0];
    },

    async updateRabUpload(
        id: number,
        newStatus: PpStatus,
        payload: UploadRabInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 link_rab = COALESCE($2, link_rab),
                 link_gambar_kerja = COALESCE($3, link_gambar_kerja),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING ${PP_COLUMNS}`,
            [newStatus, payload.link_rab ?? null, payload.link_gambar_kerja ?? null, id]
        );
        return result.rows[0];
    },

    async updateStatusAndPpManagerApproval(
        id: number,
        newStatus: PpStatus,
        action: ApprovalInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 pp_manager_approver_email = $2,
                 pp_manager_waktu_persetujuan = NOW(),
                 pp_manager_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING ${PP_COLUMNS}`,
            [newStatus, action.approver_email, id]
        );
        return result.rows[0];
    },

    async updateStatusAndPp2Approval(
        id: number,
        newStatus: PpStatus,
        action: ApprovalInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = $1,
                 pp2_approver_email = $2,
                 pp2_waktu_persetujuan = NOW(),
                 pp2_alasan_penolakan = NULL,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING ${PP_COLUMNS}`,
            [newStatus, action.approver_email, id]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // LOG
    // ----------------------------------------------------------

    async insertLog(payload: {
        projek_planning_id: number;
        actor_email: string;
        role: PpRole;
        aksi: PpAksi;
        status_sebelum: PpStatus | null;
        status_sesudah: PpStatus;
        alasan_penolakan?: string | null;
        keterangan?: string | null;
    }, client?: PoolClient): Promise<ProjekPlanningLogRow> {
        const db = client ?? pool;
        const result = await db.query<ProjekPlanningLogRow>(
            `INSERT INTO projek_planning_log (
                projek_planning_id, actor_email, role, aksi,
                status_sebelum, status_sesudah,
                alasan_penolakan, keterangan, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *`,
            [
                payload.projek_planning_id,
                payload.actor_email,
                payload.role,
                payload.aksi,
                payload.status_sebelum ?? null,
                payload.status_sesudah,
                payload.alasan_penolakan ?? null,
                payload.keterangan ?? null,
            ]
        );
        return result.rows[0];
    },

    // Gabungkan update + insert log dalam satu transaksi (benar-benar atomic)
    async updateStatusWithLog(
        id: number,
        logPayload: {
            actor_email: string;
            role: PpRole;
            aksi: PpAksi;
            status_sebelum: PpStatus;
            status_sesudah: PpStatus;
            alasan_penolakan?: string | null;
            keterangan?: string | null;
        },
        // Closure yang menerima client untuk dipakai dalam transaksi
        updateQueryFn: (client: PoolClient) => Promise<ProjekPlanningRow>
    ): Promise<{ projek: ProjekPlanningRow; log: ProjekPlanningLogRow }> {
        let projek!: ProjekPlanningRow;
        let log!: ProjekPlanningLogRow;

        await withTransaction(async (client) => {
            // 1. Jalankan update status
            projek = await updateQueryFn(client);

            // 2. Insert log di transaksi yang sama
            const logResult = await client.query<ProjekPlanningLogRow>(
                `INSERT INTO projek_planning_log (
                    projek_planning_id, actor_email, role, aksi,
                    status_sebelum, status_sesudah,
                    alasan_penolakan, keterangan, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING *`,
                [
                    id,
                    logPayload.actor_email,
                    logPayload.role,
                    logPayload.aksi,
                    logPayload.status_sebelum,
                    logPayload.status_sesudah,
                    logPayload.alasan_penolakan ?? null,
                    logPayload.keterangan ?? null,
                ]
            );
            log = logResult.rows[0];
        });

        return { projek, log };
    },
};
