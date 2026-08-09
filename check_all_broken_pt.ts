import { pool } from "./src/db/pool";

async function run() {
    try {
        const toko = await pool.query(`
            SELECT id, nomor_ulok, nama_kontraktor 
            FROM toko 
            WHERE nama_kontraktor = 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Broken Toko count:", toko.rows.length);

        const rab = await pool.query(`
            SELECT id, id_toko, email_pembuat, nama_pt 
            FROM rab 
            WHERE nama_pt = 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Broken RAB count:", rab.rows.length);

        const spk = await pool.query(`
            SELECT id, nomor_ulok, nama_pt 
            FROM pengajuan_spk 
            WHERE nama_pt = 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Broken SPK count:", spk.rows.length);

        // We also need to map these to the correct PT names.
        // For rab, we can use email_pembuat to find user_cabang.
        const emails = [...new Set(rab.rows.map(r => r.email_pembuat))];
        console.log("Unique emails involved:", emails);

        for (const email of emails) {
            const user = await pool.query(`
                SELECT nama_pt FROM user_cabang WHERE email_sat = $1 LIMIT 1
            `, [email]);
            console.log(`PT for ${email}:`, user.rows[0]?.nama_pt);
        }
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
