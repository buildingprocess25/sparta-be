import { pool } from '../../db/pool';

export class SerahTerimaGabunganRepository {
    static async getTokoPair(nomor_ulok: string) {
        const query = `
            SELECT id, lingkup_pekerjaan, nama_toko, cabang 
            FROM toko 
            WHERE nomor_ulok = $1 AND lingkup_pekerjaan IN ('SIPIL', 'ME')
        `;
        const res = await pool.query(query, [nomor_ulok]);
        return res.rows;
    }

    static async checkOpnameApproved(id_toko: number) {
        const query = `
            SELECT status_opname_final, workflow_version 
            FROM opname_final 
            WHERE id_toko = $1 
            ORDER BY id DESC LIMIT 1
        `;
        const res = await pool.query(query, [id_toko]);
        if (res.rows.length === 0) return false;
        
        const row = res.rows[0];
        const isApproved = row.status_opname_final?.toUpperCase() === 'DISETUJUI';
        const isContractorFirst = row.workflow_version === 'contractor_first';
        
        return isApproved && isContractorFirst;
    }

    static async checkPengawasanDone(id_toko: number) {
        // Find if there are any incomplete pengawasan items
        const query = `
            SELECT COUNT(*) as incomplete
            FROM pengawasan p
            JOIN pengawasan_gantt pg ON p.id_pengawasan_gantt = pg.id
            WHERE pg.id_toko = $1 AND p.status != 'SELESAI'
        `;
        const res = await pool.query(query, [id_toko]);
        return parseInt(res.rows[0].incomplete) === 0;
    }
    static async upsertDraft(nomor_ulok: string, state: any) {
        // Create main record if not exists
        let res = await pool.query(`SELECT id FROM serah_terima_gabungan WHERE nomor_ulok = $1 LIMIT 1`, [nomor_ulok]);
        let stId;
        if (res.rows.length === 0) {
            const tokos = await this.getTokoPair(nomor_ulok);
            const sipil = tokos.find((t: any) => t.lingkup_pekerjaan === 'SIPIL');
            const me = tokos.find((t: any) => t.lingkup_pekerjaan === 'ME');
            
            res = await pool.query(`
                INSERT INTO serah_terima_gabungan (nomor_ulok, id_toko_sipil, id_toko_me, nama_toko, cabang, tanggal_serah_terima)
                VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
                RETURNING id
            `, [nomor_ulok, sipil?.id, me?.id, sipil?.nama_toko, sipil?.cabang]);
            stId = res.rows[0].id;
        } else {
            stId = res.rows[0].id;
        }

        // Delete existing items
        await pool.query(`DELETE FROM serah_terima_gabungan_item WHERE id_serah_terima_gabungan = $1`, [stId]);

        // Load JSON mapping
        const fs = require('fs');
        const path = require('path');
        const templatePath = path.join(__dirname, '../../constants/serah-terima-items.json');
        let templateItems: any[] = [];
        if (fs.existsSync(templatePath)) {
            templateItems = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        }
        const itemMap = new Map(templateItems.map(i => [i.id_item, i]));

        // Insert new items
        for (const [id_item, data] of Object.entries(state as Record<string, any>)) {
            // Check if it's filled (isAvailable not null)
            if (data.isAvailable === null || data.isAvailable === undefined) continue;

            const is_available = data.isAvailable === true;
            const link_foto = data.file ? (data.file.url || data.file.name) : null;
            const meta = itemMap.get(id_item) || {};
            
            await pool.query(`
                INSERT INTO serah_terima_gabungan_item (
                    id_serah_terima_gabungan, id_item, is_available, link_foto,
                    kategori, nama_kategori, nama_item, no_urut
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                stId, id_item, is_available, link_foto,
                meta.kategori || null, 
                meta.nama_kategori || null, 
                meta.nama_item || null, 
                meta.no_urut || null
            ]);
        }
    }

    static async getDraft(nomor_ulok: string) {
        const query = `
            SELECT i.id_item, i.is_available, i.link_foto
            FROM serah_terima_gabungan_item i
            JOIN serah_terima_gabungan g ON g.id = i.id_serah_terima_gabungan
            WHERE g.nomor_ulok = $1
        `;
        const res = await pool.query(query, [nomor_ulok]);
        const state: Record<string, any> = {};
        for (const row of res.rows) {
            state[row.id_item] = {
                isAvailable: row.is_available,
                file: row.link_foto ? { name: row.link_foto, url: row.link_foto } : null
            };
        }
        return state;
    }

    static async submitForm(nomor_ulok: string) {
        await pool.query(
            `UPDATE serah_terima_gabungan SET is_contractor_submitted = true WHERE nomor_ulok = $1`,
            [nomor_ulok]
        );
    }

    static async getFullDataForPdf(nomor_ulok: string) {
        const resHeader = await pool.query(`SELECT * FROM serah_terima_gabungan WHERE nomor_ulok = $1`, [nomor_ulok]);
        if (resHeader.rows.length === 0) return null;

        const resItems = await pool.query(
            `SELECT * FROM serah_terima_gabungan_item WHERE id_serah_terima_gabungan = $1 AND is_available = true AND link_foto IS NOT NULL ORDER BY id_item`,
            [resHeader.rows[0].id]
        );

        return {
            header: resHeader.rows[0],
            items: resItems.rows
        };
    }

    static async assertSubmitted(nomor_ulok: string) {
        const res = await pool.query(`SELECT is_contractor_submitted FROM serah_terima_gabungan WHERE nomor_ulok = $1`, [nomor_ulok]);
        if (res.rows.length === 0 || !res.rows[0].is_contractor_submitted) {
            const { AppError } = require("../../common/app-error");
            throw new AppError("Checklist Dokumentasi Bangunan (Serah Terima Gabungan) belum dikirim (Kirim Form) oleh kontraktor.", 409);
        }
    }
}
