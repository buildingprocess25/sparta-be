import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const ULOK = '1GZ1-2603-1GC5-R';
const ME_CATEGORIES = ['INSTALASI', 'FIXTURE']; // Kategori yang pasti milik ME

async function run() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        console.log(`[START] Memperbaiki RAB Sipil untuk ULOK: ${ULOK}`);

        // 1. Cari Toko Sipil
        const tokoRes = await client.query(
            `SELECT id, nomor_ulok, lingkup_pekerjaan 
             FROM toko 
             WHERE UPPER(nomor_ulok) = UPPER($1) 
               AND UPPER(lingkup_pekerjaan) = 'SIPIL'`,
            [ULOK]
        );

        if (tokoRes.rowCount === 0) {
            console.log(`❌ Toko Sipil dengan ULOK ${ULOK} tidak ditemukan.`);
            return;
        }

        const idToko = tokoRes.rows[0].id;
        console.log(`✅ Ditemukan Toko Sipil (ID: ${idToko})`);

        // 2. Cari RAB aktif untuk toko tersebut
        const rabRes = await client.query(
            `SELECT id, status FROM rab WHERE id_toko = $1 ORDER BY id DESC LIMIT 1`,
            [idToko]
        );

        if (rabRes.rowCount === 0) {
            console.log(`❌ Tidak ada RAB untuk Toko ID ${idToko}`);
            return;
        }

        const idRab = rabRes.rows[0].id;
        console.log(`✅ Ditemukan RAB (ID: ${idRab}) dengan status: ${rabRes.rows[0].status}`);

        // 3. Lihat item sebelum dihapus
        const itemRes = await client.query(
            `SELECT id, kategori_pekerjaan, jenis_pekerjaan 
             FROM rab_item 
             WHERE id_rab = $1`,
            [idRab]
        );
        
        console.log(`Total item di RAB ini: ${itemRes.rowCount}`);
        
        const meItems = itemRes.rows.filter(item => 
            ME_CATEGORIES.includes(item.kategori_pekerjaan.toUpperCase())
        );

        console.log(`⚠️  Ditemukan ${meItems.length} item kategori ME murni (Instalasi/Fixture) yang nyasar ke Sipil.`);
        meItems.forEach(i => console.log(`   - ID: ${i.id} | ${i.kategori_pekerjaan} | ${i.jenis_pekerjaan}`));

        if (meItems.length === 0) {
            console.log(`✅ Tidak ada item ME murni yang perlu dihapus.`);
            await client.query("ROLLBACK");
            return;
        }

        // 4. Hapus item ME
        const idsToDelete = meItems.map(i => i.id);
        const deleteRes = await client.query(
            `DELETE FROM rab_item WHERE id = ANY($1::int[]) RETURNING id`,
            [idsToDelete]
        );

        console.log(`🗑️  Berhasil menghapus ${deleteRes.rowCount} item ME dari RAB Sipil.`);

        // 5. Update grand total RAB (karena item dihapus, total harus dihitung ulang)
        const sumRes = await client.query(
            `SELECT 
                COALESCE(SUM(total_harga), 0) as grand_total,
                COALESCE(SUM(CASE WHEN UPPER(kategori_pekerjaan) != 'PEKERJAAN SBO' THEN total_harga ELSE 0 END), 0) as grand_total_non_sbo
             FROM rab_item 
             WHERE id_rab = $1`,
            [idRab]
        );

        const newGrandTotal = sumRes.rows[0].grand_total;
        const newGrandTotalNonSbo = sumRes.rows[0].grand_total_non_sbo;

        await client.query(
            `UPDATE rab 
             SET grand_total = $1, grand_total_non_sbo = $2 
             WHERE id = $3`,
            [newGrandTotal, newGrandTotalNonSbo, idRab]
        );
        console.log(`💰 Grand Total RAB (ID: ${idRab}) telah diupdate menjadi: ${newGrandTotal}`);

        await client.query("COMMIT");
        console.log("🎉 SUCCESS: Data RAB berhasil dibersihkan!");

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ ERROR:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
