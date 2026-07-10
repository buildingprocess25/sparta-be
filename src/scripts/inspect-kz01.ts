import { pool } from "../db/pool";

async function run() {
    const nomorUlok = "kz01-2604-0001";
    
    // Search using LIKE to find any matching pattern
    const r = await pool.query(`
        SELECT 
            s.id as spk_id,
            s.nomor_ulok,
            s.lingkup_pekerjaan,
            s.status as spk_status,
            s.id_toko,
            g.id as gantt_id,
            g.status as gantt_status
        FROM pengajuan_spk s
        LEFT JOIN gantt_chart g ON g.id_toko = s.id_toko
        WHERE LOWER(s.nomor_ulok) LIKE LOWER($1)
        ORDER BY s.lingkup_pekerjaan, s.created_at DESC
    `, [`%kz01%2604%0001%`]);
    
    console.log(JSON.stringify(r.rows, null, 2));
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
