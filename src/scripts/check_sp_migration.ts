import { pool } from "../db/pool";

async function main() {
    try {
        const result = await pool.query(`
      SELECT * FROM pengajuan_spk WHERE nomor_ulok = 'Z001-2512-4444'
    `);
        console.log("Current Denda Actions:");
        console.table(result.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
