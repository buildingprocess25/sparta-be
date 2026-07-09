import { pool } from "./src/db/pool";

async function main() {
    try {
        console.log("Checking toko with nomor_ulok UZ01-2603-0021...");
        const toko = await pool.query(`SELECT id, nomor_ulok, cabang, toko, nama_kontraktor, lingkup_pekerjaan FROM toko WHERE nomor_ulok = 'UZ01-2603-0021'`);
        console.log("Toko:", toko.rows);

        if (toko.rows.length > 0) {
            console.log("\nChecking gantt table...");
            const gantt = await pool.query(`SELECT id, id_toko, status FROM gantt WHERE id_toko = ANY($1::int[])`, [toko.rows.map(r => r.id)]);
            console.log("Gantt:", gantt.rows);

            if (gantt.rows.length > 0) {
                console.log("\nChecking pengawasan_gantt table...");
                const pg = await pool.query(`SELECT id, id_gantt, status FROM pengawasan_gantt WHERE id_gantt = ANY($1::int[])`, [gantt.rows.map(r => r.id)]);
                console.log("Pengawasan Gantt:", pg.rows);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
