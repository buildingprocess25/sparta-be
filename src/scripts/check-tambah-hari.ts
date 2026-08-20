import { pool } from "../db/pool";

async function run() {
    try {
        console.log("Checking pertambahan_spk table columns...");
        const colsResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pertambahan_spk'
        `);
        console.table(colsResult.rows);

        console.log("\nChecking recent pertambahan_spk data...");
        const dataResult = await pool.query(`
            SELECT id, id_spk, pertambahan_hari, target_st_setelah_perpanjangan, tanggal_spk_akhir_setelah_perpanjangan, status_persetujuan
            FROM pertambahan_spk
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.table(dataResult.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
