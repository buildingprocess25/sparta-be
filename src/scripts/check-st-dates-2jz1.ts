import { pool } from "../db/pool";

async function check() {
    const result = await pool.query(`
        SELECT 
            t.id, 
            t.lingkup_pekerjaan,
            ps.waktu_selesai::date AS spk_end,
            bst.created_at AS st_datetime,
            bst.created_at::date AS st_date
        FROM toko t
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        WHERE t.nomor_ulok = '2JZ1-2603-0003'
        ORDER BY bst.created_at ASC, t.id
    `);

    console.log("ULOK 2JZ1-2603-0003 - ST Dates:");
    console.log(JSON.stringify(result.rows, null, 2));
    
    await pool.end();
}

check();
