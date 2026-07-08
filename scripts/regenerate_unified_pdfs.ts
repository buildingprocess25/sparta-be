import { pool } from "../src/db/pool";
import { serahTerimaService } from "../src/modules/serah-terima/serah-terima.service";

async function run() {
    try {
        console.log("Mulai mencari ULOK dengan Serah Terima Gabungan (SIPIL + ME)...");

        const result = await pool.query(`
            SELECT t.nomor_ulok 
            FROM toko t 
            JOIN berkas_serah_terima b ON t.id = b.id_toko 
            WHERE t.lingkup_pekerjaan IN ('SIPIL', 'ME') 
              AND b.link_pdf IS NOT NULL 
            GROUP BY t.nomor_ulok 
            HAVING COUNT(DISTINCT t.lingkup_pekerjaan) > 1
        `);

        const uloks = result.rows.map(row => row.nomor_ulok);
        console.log(`Ditemukan ${uloks.length} ULOK gabungan yang perlu di-regenerate.`);

        let success = 0;
        let failed = 0;

        for (const ulok of uloks) {
            console.log(`\nSedang me-regenerate PDF untuk ULOK: ${ulok}...`);
            try {
                await serahTerimaService.createPdfSerahTerimaUnified(ulok);
                console.log(`[BERHASIL] PDF untuk ULOK ${ulok} berhasil di-regenerate.`);
                success++;
            } catch (err: any) {
                console.error(`[GAGAL] Gagal me-regenerate PDF untuk ULOK ${ulok}:`, err.message);
                failed++;
            }
            
            // Jeda sebentar agar tidak terlalu membebani sistem
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log("\n==================================================");
        console.log("PROSES SELESAI");
        console.log(`Total Diproses : ${uloks.length}`);
        console.log(`Berhasil       : ${success}`);
        console.log(`Gagal          : ${failed}`);
        console.log("==================================================");

        process.exit(0);
    } catch (err) {
        console.error("Terjadi kesalahan fatal:", err);
        process.exit(1);
    }
}

run();
