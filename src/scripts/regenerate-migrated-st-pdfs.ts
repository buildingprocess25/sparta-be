import "dotenv/config";
// Override token path ke file lokal karena .env menunjuk ke /etc/secrets (server Linux)
process.env.GOOGLE_TOKEN_PATH = "token.json";
process.env.GOOGLE_DOC_TOKEN_PATH = "token_doc.json";
import { pool } from "../db/pool";
import { GoogleProvider } from "../common/google";
import { serahTerimaService } from "../modules/serah-terima/serah-terima.service";

async function run() {
    console.log("Menginisialisasi koneksi Google Drive...");
    await GoogleProvider.initialize();
    console.log("Menyiapkan data Serah Terima untuk regenerate PDF...");
    const result = await pool.query<{ id_toko: number, id: number }>(`
        SELECT id_toko, id
        FROM berkas_serah_terima
        ORDER BY id ASC
    `);

    const tokos = result.rows;
    console.log(`Ditemukan ${tokos.length} data Serah Terima.`);

    let success = 0;
    let failed = 0;

    for (const toko of tokos) {
        try {
            console.log(`Regenerating PDF untuk id_toko=${toko.id_toko}...`);
            await serahTerimaService.createPdfSerahTerima(toko.id_toko);
            success++;
            // Delay to avoid Google Drive API rate limit
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`Gagal regenerate PDF untuk id_toko=${toko.id_toko}:`, error);
            failed++;
        }
    }

    console.log("=== Proses Selesai ===");
    console.log(`Berhasil: ${success}`);
    console.log(`Gagal: ${failed}`);
    process.exit(0);
}

run().catch((err) => {
    console.error("Terjadi kesalahan fatal:", err);
    process.exit(1);
});
