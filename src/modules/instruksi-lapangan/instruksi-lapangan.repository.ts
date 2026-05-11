import { pool } from "../../db/pool";
import type { InstruksiLapanganItemInput, SubmitInstruksiLapanganInput } from "./instruksi-lapangan.schema";

export interface InstruksiLapanganRow {
    id: number;
    id_toko: number;
    status: string;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    link_lampiran: string | null;
    email_pembuat: string;
    tanggal_mulai: string | null;
    tanggal_selesai: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    pemberi_persetujuan_kontraktor: string | null;
    waktu_persetujuan_kontraktor: string | null;
    alasan_penolakan: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string;
}

export interface InstruksiLapanganItemRow {
    id: number;
    id_instruksi_lapangan: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
    total_material: number;
    total_upah: number;
    total_harga: number;
}

export interface TokoRow {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string;
    kode_toko: string;
    proyek: string;
    cabang: string;
    alamat: string;
    nama_kontraktor: string;
}

export const instruksiLapanganRepository = {
    async insertWithItems(
        input: SubmitInstruksiLapanganInput,
        idToko: number,
        lampiranPath?: string
    ) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Hitung grand total
            let grandTotal = 0;
            const items = input.detail_items.map(item => {
                const totalMaterial = item.harga_material * item.volume;
                const totalUpah = item.harga_upah * item.volume;
                const totalHarga = totalMaterial + totalUpah;
                grandTotal += totalHarga;
                return {
                    ...item,
                    totalMaterial,
                    totalUpah,
                    totalHarga
                };
            });

            const insertHeaderRes = await client.query(`
                INSERT INTO instruksi_lapangan (
                    id_toko, status, email_pembuat, link_lampiran, grand_total,
                    tanggal_mulai, tanggal_selesai
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
            `, [
                idToko,
                "Menunggu Persetujuan Koordinator",
                input.email_pembuat,
                lampiranPath || null,
                grandTotal.toString(),
                input.tanggal_mulai,
                input.tanggal_selesai
            ]);

            const header = insertHeaderRes.rows[0];

            for (const item of items) {
                await client.query(`
                    INSERT INTO instruksi_lapangan_item (
                        id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan,
                        satuan, volume, harga_material, harga_upah,
                        total_material, total_upah, total_harga
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    header.id, item.kategori_pekerjaan, item.jenis_pekerjaan,
                    item.satuan, item.volume, item.harga_material, item.harga_upah,
                    item.totalMaterial, item.totalUpah, item.totalHarga
                ]);
            }

            await client.query("COMMIT");
            return header.id;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    async getById(id: string | number) {
        const res = await pool.query(`
            SELECT il.*, t.nomor_ulok, t.nama_toko, t.cabang
            FROM instruksi_lapangan il
            JOIN toko t ON il.id_toko = t.id
            WHERE il.id = $1
        `, [id]);
        return res.rows[0] || null;
    },

    async getLatestByTokoId(idToko: number): Promise<InstruksiLapanganRow | null> {
        const res = await pool.query(
            "SELECT * FROM instruksi_lapangan WHERE id_toko = $1 ORDER BY id DESC LIMIT 1",
            [idToko]
        );
        return res.rows[0] || null;
    },

    async replaceRejectedWithDetails(
        idIL: number,
        input: SubmitInstruksiLapanganInput,
        lampiranPath?: string
    ) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Delete old items
            await client.query("DELETE FROM instruksi_lapangan_item WHERE id_instruksi_lapangan = $1", [idIL]);

            let grandTotal = 0;
            const items = input.detail_items.map(item => {
                const totalMaterial = item.harga_material * item.volume;
                const totalUpah = item.harga_upah * item.volume;
                const totalHarga = totalMaterial + totalUpah;
                grandTotal += totalHarga;
                return { ...item, totalMaterial, totalUpah, totalHarga };
            });

            // Update header
            const updateFields = [
                "status = 'Menunggu Persetujuan Koordinator'",
                "alasan_penolakan = NULL",
                "pemberi_persetujuan_koordinator = NULL",
                "waktu_persetujuan_koordinator = NULL",
                "pemberi_persetujuan_manager = NULL",
                "waktu_persetujuan_manager = NULL",
                "pemberi_persetujuan_kontraktor = NULL",
                "waktu_persetujuan_kontraktor = NULL",
                "created_at = timezone('Asia/Jakarta', now())",
                `grand_total = '${grandTotal.toString()}'`,
                `tanggal_mulai = '${input.tanggal_mulai}'`,
                `tanggal_selesai = '${input.tanggal_selesai}'`
            ];
            
            const params: any[] = [idIL];
            
            if (lampiranPath !== undefined) {
                params.push(lampiranPath || null);
                updateFields.push(`link_lampiran = $2`);
            }

            await client.query(`
                UPDATE instruksi_lapangan
                SET ${updateFields.join(", ")}
                WHERE id = $1
            `, params);

            for (const item of items) {
                await client.query(`
                    INSERT INTO instruksi_lapangan_item (
                        id_instruksi_lapangan, kategori_pekerjaan, jenis_pekerjaan,
                        satuan, volume, harga_material, harga_upah,
                        total_material, total_upah, total_harga
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    idIL, item.kategori_pekerjaan, item.jenis_pekerjaan,
                    item.satuan, item.volume, item.harga_material, item.harga_upah,
                    item.totalMaterial, item.totalUpah, item.totalHarga
                ]);
            }

            await client.query("COMMIT");
            return idIL;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    async getHeaderAndToko(id: string | number): Promise<{ instruksiLapangan: InstruksiLapanganRow, toko: TokoRow } | null> {
        const resIL = await pool.query(`
            SELECT * FROM instruksi_lapangan WHERE id = $1
        `, [id]);
        
        if (resIL.rows.length === 0) return null;
        
        const il = resIL.rows[0];
        
        const resToko = await pool.query(`
            SELECT * FROM toko WHERE id = $1
        `, [il.id_toko]);
        
        return {
            instruksiLapangan: il,
            toko: resToko.rows[0]
        };
    },

    async getItems(idIL: string | number): Promise<InstruksiLapanganItemRow[]> {
        const res = await pool.query(`
            SELECT * FROM instruksi_lapangan_item WHERE id_instruksi_lapangan = $1 ORDER BY id ASC
        `, [idIL]);
        return res.rows;
    },

    async getTokoByUlok(nomorUlok: string): Promise<TokoRow | null> {
        const res = await pool.query(`
            SELECT * FROM toko WHERE nomor_ulok = $1
        `, [nomorUlok]);
        return res.rows[0] || null;
    },

    async updatePdfLinks(
        id: number | string,
        updates: { pdfGabungan: string; pdfNonSbo: string; pdfRekapitulasi: string; grandTotalNonSbo: string; grandTotalFinal: string }
    ) {
        await pool.query(`
            UPDATE instruksi_lapangan
            SET link_pdf_gabungan = $1,
                link_pdf_non_sbo = $2,
                link_pdf_rekapitulasi = $3,
                grand_total_non_sbo = $4,
                grand_total_final = $5
            WHERE id = $6
        `, [
            updates.pdfGabungan, updates.pdfNonSbo, updates.pdfRekapitulasi,
            updates.grandTotalNonSbo, updates.grandTotalFinal, id
        ]);
    },

    async updateApproval(
        id: number | string,
        status: string,
        approverRole: 'koordinator' | 'manager' | 'kontraktor',
        approverEmail: string,
        alasanPenolakan?: string
    ) {
        const now = new Date();
        const timeField = `waktu_persetujuan_${approverRole}`;
        const emailField = `pemberi_persetujuan_${approverRole}`;

        let query = `UPDATE instruksi_lapangan SET status = $1, ${emailField} = $2, ${timeField} = $3`;
        const params: any[] = [status, approverEmail, now];

        if (alasanPenolakan !== undefined) {
            query += `, alasan_penolakan = $4 WHERE id = $5`;
            params.push(alasanPenolakan, id);
        } else {
            query += ` WHERE id = $4`;
            params.push(id);
        }

        await pool.query(query, params);
    },

    async findMany(query: { status?: string; nomor_ulok?: string; cabang?: string; email_pembuat?: string; id_toko?: number }) {
        const conditions: string[] = [];
        const params: any[] = [];
        let index = 1;

        let sql = `
            SELECT il.*, t.nomor_ulok, t.nama_toko, t.cabang
            FROM instruksi_lapangan il
            JOIN toko t ON il.id_toko = t.id
            WHERE 1=1
        `;

        if (query.status) {
            conditions.push(`il.status = $${index++}`);
            params.push(query.status);
        }
        if (query.nomor_ulok) {
            conditions.push(`t.nomor_ulok ILIKE $${index++}`);
            params.push(`%${query.nomor_ulok}%`);
        }
        if (query.cabang) {
            conditions.push(`t.cabang ILIKE $${index++}`);
            params.push(`%${query.cabang}%`);
        }
        if (query.email_pembuat) {
            conditions.push(`il.email_pembuat ILIKE $${index++}`);
            params.push(`%${query.email_pembuat}%`);
        }
        if (query.id_toko) {
            conditions.push(`il.id_toko = $${index++}`);
            params.push(query.id_toko);
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        sql += " ORDER BY il.created_at DESC";

        const res = await pool.query(sql, params);
        return res.rows;
    }
};
