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
    // Fasilitas (dari tabel terpisah)
    fasilitas?: {
        id?: number;
        jenis_fasilitas: string;
        nama_fasilitas_lainnya?: string | null;
        is_tersedia: boolean;
        keterangan?: string | null;
    }[];

    // Ketentuan (dari tabel terpisah)
    ketentuan?: { id?: number; isi_ketentuan: string }[];

    // Catatan Design (dari tabel terpisah)
    catatan_design?: { id?: number; isi_catatan: string }[];

    // Foto Lampiran FPD (dari tabel terpisah)
    foto_items?: { id?: number; item_index: number; link_foto: string }[];

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
    is_ruko: boolean;
    jumlah_lantai: number | null;
    link_gambar_kompetitor: string | null;

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
    link_fpd, link_rab, link_gambar_kerja, link_desain_3d, link_fpd_approved,
    link_gambar_rab_sipil, link_gambar_rab_me, link_gambar_kompetitor,
    status, butuh_desain_3d, is_ruko, jumlah_lantai,
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
        const headerResult = await pool.query<ProjekPlanningRow & { alamat_toko?: string }>(
            `SELECT ${PP_COLUMNS}, (SELECT alamat FROM toko WHERE toko.id = projek_planning.id_toko) as alamat_toko FROM projek_planning WHERE id = $1`,
            [id]
        );

        if ((headerResult.rowCount ?? 0) === 0) return null;
        const projek = headerResult.rows[0];

        const [logsRes, fasilitasRes, ketentuanRes, catatanRes, fotoRes] = await Promise.all([
            pool.query<ProjekPlanningLogRow>(
                `SELECT * FROM projek_planning_log WHERE projek_planning_id = $1 ORDER BY created_at ASC`, [id]
            ),
            pool.query(
                `SELECT id, jenis_fasilitas, nama_fasilitas_lainnya, is_tersedia, keterangan FROM projek_planning_fasilitas WHERE projek_planning_id = $1`, [id]
            ),
            pool.query(
                `SELECT id, isi_ketentuan FROM projek_planning_ketentuan WHERE projek_planning_id = $1`, [id]
            ),
            pool.query(
                `SELECT id, isi_catatan FROM projek_planning_catatan WHERE projek_planning_id = $1`, [id]
            ),
            pool.query(
                `SELECT id, item_index, link_foto FROM projek_planning_foto_item WHERE id_projek_planning = $1 ORDER BY item_index ASC`, [id]
            )
        ]);

        projek.fasilitas = fasilitasRes.rows;
        projek.ketentuan = ketentuanRes.rows;
        projek.catatan_design = catatanRes.rows;
        projek.foto_items = fotoRes.rows;

        return {
            projek,
            logs: logsRes.rows,
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
    // FOTO ITEMS
    // ----------------------------------------------------------

    async createFotoItemsBulk(id_projek_planning: number, items: { item_index: number; link_foto: string }[], client?: PoolClient): Promise<void> {
        const db = client ?? pool;
        for (const item of items) {
            await db.query(
                `INSERT INTO projek_planning_foto_item (id_projek_planning, item_index, link_foto) VALUES ($1, $2, $3)`,
                [id_projek_planning, item.item_index, item.link_foto]
            );
        }
    },

    async deleteFotoItemsBulk(id_projek_planning: number, client?: PoolClient): Promise<void> {
        const db = client ?? pool;
        await db.query(`DELETE FROM projek_planning_foto_item WHERE id_projek_planning = $1`, [id_projek_planning]);
    },

    async upsertFotoItem(id_projek_planning: number, item_index: number, link_foto: string, client?: PoolClient): Promise<void> {
        const db = client ?? pool;
        await db.query(`DELETE FROM projek_planning_foto_item WHERE id_projek_planning = $1 AND item_index = $2`, [id_projek_planning, item_index]);
        await db.query(`INSERT INTO projek_planning_foto_item (id_projek_planning, item_index, link_foto) VALUES ($1, $2, $3)`, [id_projek_planning, item_index, link_foto]);
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
        return withTransaction(async (client) => {
            const result = await client.query<ProjekPlanningRow>(
                `INSERT INTO projek_planning (
                    id_toko, nomor_ulok, email_pembuat,
                    nama_toko, kode_toko, cabang, proyek, lingkup_pekerjaan,
                    jenis_proyek, estimasi_biaya, keterangan, link_fpd,
                    nama_pengaju, nama_lokasi,
                    jenis_pengajuan, jenis_pengajuan_lainnya,
                    link_gambar_kerja, link_gambar_rab_sipil, link_gambar_rab_me,
                    link_gambar_kompetitor,
                    is_ruko, jumlah_lantai,
                    status, butuh_desain_3d,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3,
                    $4, $5, $6, $7, $8,
                    $9, $10, $11, $12,
                    $13, $14,
                    $15, $16,
                    $17, $18, $19,
                    $20,
                    $21, $22,
                    $23, FALSE,
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
                    (payload as any).link_gambar_kerja ?? null,
                    payload.link_gambar_rab_sipil ?? null,
                    payload.link_gambar_rab_me ?? null,
                    (payload as any).link_gambar_kompetitor ?? null,
                    (payload as any).is_ruko ?? false,
                    (payload as any).jumlah_lantai ?? null,
                    payload.status,
                ]
            );
            const row = result.rows[0];
            const ppId = row.id;

            if (payload.ketentuan && payload.ketentuan.length > 0) {
                for (const k of payload.ketentuan) {
                    await client.query(
                        `INSERT INTO projek_planning_ketentuan (projek_planning_id, isi_ketentuan) VALUES ($1, $2)`,
                        [ppId, k]
                    );
                }
            }
            if (payload.catatan_design && payload.catatan_design.length > 0) {
                for (const c of payload.catatan_design) {
                    await client.query(
                        `INSERT INTO projek_planning_catatan (projek_planning_id, isi_catatan) VALUES ($1, $2)`,
                        [ppId, c]
                    );
                }
            }
            if (payload.fasilitas && payload.fasilitas.length > 0) {
                for (const f of payload.fasilitas) {
                    await client.query(
                        `INSERT INTO projek_planning_fasilitas (projek_planning_id, jenis_fasilitas, nama_fasilitas_lainnya, is_tersedia, keterangan) VALUES ($1, $2, $3, $4, $5)`,
                        [ppId, f.jenis_fasilitas, f.nama_fasilitas_lainnya ?? null, f.is_tersedia, f.keterangan ?? null]
                    );
                }
            }
            
            row.ketentuan = payload.ketentuan?.map(k => ({ isi_ketentuan: k })) || [];
            row.catatan_design = payload.catatan_design?.map(c => ({ isi_catatan: c })) || [];
            row.fasilitas = payload.fasilitas || [];
            
            return row;
        });
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
        return withTransaction(async (client) => {
            const result = await client.query<ProjekPlanningRow>(
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
                     link_gambar_rab_sipil = $15,
                     link_gambar_rab_me = $16,
                     link_gambar_kerja = COALESCE($17, link_gambar_kerja),
                     link_gambar_kompetitor = COALESCE($18, link_gambar_kompetitor),
                     is_ruko = $19,
                     jumlah_lantai = $20,
                     status = $21,
                     butuh_desain_3d = FALSE,
                     bm_approver_email = NULL,
                     bm_waktu_persetujuan = NULL,
                     pp1_approver_email = NULL,
                     pp1_waktu_persetujuan = NULL,
                     pp_manager_approver_email = NULL,
                     pp_manager_waktu_persetujuan = NULL,
                     pp2_approver_email = NULL,
                     pp2_waktu_persetujuan = NULL,
                     updated_at = NOW()
                 WHERE id = $22
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
                    payload.link_gambar_rab_sipil ?? null,
                    payload.link_gambar_rab_me ?? null,
                    (payload as any).link_gambar_kerja ?? null,
                    (payload as any).link_gambar_kompetitor ?? null,
                    (payload as any).is_ruko ?? false,
                    (payload as any).jumlah_lantai ?? null,
                    payload.status,
                    id,
                ]
            );
            const row = result.rows[0];

            // Re-create relations
            await client.query(`DELETE FROM projek_planning_ketentuan WHERE projek_planning_id = $1`, [id]);
            await client.query(`DELETE FROM projek_planning_catatan WHERE projek_planning_id = $1`, [id]);
            await client.query(`DELETE FROM projek_planning_fasilitas WHERE projek_planning_id = $1`, [id]);

            if (payload.ketentuan && payload.ketentuan.length > 0) {
                for (const k of payload.ketentuan) {
                    await client.query(`INSERT INTO projek_planning_ketentuan (projek_planning_id, isi_ketentuan) VALUES ($1, $2)`, [id, k]);
                }
            }
            if (payload.catatan_design && payload.catatan_design.length > 0) {
                for (const c of payload.catatan_design) {
                    await client.query(`INSERT INTO projek_planning_catatan (projek_planning_id, isi_catatan) VALUES ($1, $2)`, [id, c]);
                }
            }
            if (payload.fasilitas && payload.fasilitas.length > 0) {
                for (const f of payload.fasilitas) {
                    await client.query(
                        `INSERT INTO projek_planning_fasilitas (projek_planning_id, jenis_fasilitas, nama_fasilitas_lainnya, is_tersedia, keterangan) VALUES ($1, $2, $3, $4, $5)`,
                        [id, f.jenis_fasilitas, f.nama_fasilitas_lainnya ?? null, f.is_tersedia, f.keterangan ?? null]
                    );
                }
            }
            
            row.ketentuan = payload.ketentuan?.map(k => ({ isi_ketentuan: k })) || [];
            row.catatan_design = payload.catatan_design?.map(c => ({ isi_catatan: c })) || [];
            row.fasilitas = payload.fasilitas || [];
            
            return row;
        });
    },

    // ----------------------------------------------------------
    // RESET ke DRAFT (saat ditolak oleh BM / PP1)
    // ----------------------------------------------------------

    async updateStatusAndRejectToDraft(
        id: number,
        role: PpRole,
        action: ApprovalInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const setRoleFields = role === "BM"
            ? `bm_approver_email = $2, bm_waktu_persetujuan = NOW(), bm_alasan_penolakan = $3`
            : `pp1_approver_email = $2, pp1_waktu_persetujuan = NOW(), pp1_alasan_penolakan = $3`;

        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = 'DRAFT',
                 butuh_desain_3d = FALSE,
                 ${setRoleFields},
                 updated_at = NOW()
             WHERE id = $1
             RETURNING ${PP_COLUMNS}`,
            [id, action.approver_email, action.alasan_penolakan ?? null]
        );
        return result.rows[0];
    },

    // ----------------------------------------------------------
    // RESET ke RAB UPLOAD (saat ditolak oleh PP2 / PP Manager)
    // ----------------------------------------------------------

    async updateStatusAndRejectToRabUpload(
        id: number,
        role: PpRole,
        action: ApprovalInput,
        client?: PoolClient
    ): Promise<ProjekPlanningRow> {
        const db = client ?? pool;
        const setRoleFields = role === "PP_MANAGER"
            ? `pp_manager_approver_email = $2, pp_manager_waktu_persetujuan = NOW(), pp_manager_alasan_penolakan = $3`
            : `pp2_approver_email = $2, pp2_waktu_persetujuan = NOW(), pp2_alasan_penolakan = $3`;

        const result = await db.query<ProjekPlanningRow>(
            `UPDATE projek_planning
             SET status = 'WAITING_RAB_UPLOAD',
                 ${setRoleFields},
                 updated_at = NOW()
             WHERE id = $1
             RETURNING ${PP_COLUMNS}`,
            [id, action.approver_email, action.alasan_penolakan ?? null]
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
