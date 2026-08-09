import { pool } from "./src/db/pool";

async function run() {
    try {
        const rabQuery = await pool.query(`
            SELECT 
                r.id as rab_id,
                t.nomor_ulok,
                r.email_pembuat,
                r.nama_pt as rab_nama_pt,
                t.nama_kontraktor as toko_nama_kontraktor,
                t.id as toko_id
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            WHERE r.nama_pt = 'NAMA PT TIDAK DITEMUKAN' OR t.nama_kontraktor = 'NAMA PT TIDAK DITEMUKAN'
        `);

        console.log("| ID RAB | ID Toko | Nomor ULOK | Email Pembuat | NAMA PT (Before) | NAMA KONTRAKTOR TOKO (Before) | TARGET NAMA PT (After) |");
        console.log("|---|---|---|---|---|---|---|");

        for (const row of rabQuery.rows) {
            let targetPt = 'UNKNOWN';
            if (row.email_pembuat) {
                const userQuery = await pool.query(`
                    SELECT nama_pt FROM user_cabang WHERE email_sat = $1 LIMIT 1
                `, [row.email_pembuat]);
                if (userQuery.rows.length > 0) {
                    targetPt = userQuery.rows[0].nama_pt;
                }
            }
            console.log(`| ${row.rab_id} | ${row.toko_id} | ${row.nomor_ulok} | ${row.email_pembuat} | ${row.rab_nama_pt} | ${row.toko_nama_kontraktor} | ${targetPt} |`);
        }
        
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
