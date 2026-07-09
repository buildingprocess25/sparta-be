import { pool } from "./src/db/pool";

async function run() {
    const res = await pool.query(`
        SELECT t.id, t.nomor_ulok, t.lingkup_pekerjaan
        FROM toko t
        WHERE t.nomor_ulok = 'HZ01-2605-H579-R'
    `);
    
    console.log("Toko:", res.rows);
    
    for (const toko of res.rows) {
        const gantt = await pool.query(`
            SELECT * FROM gantt_chart WHERE id_toko = $1 ORDER BY id DESC LIMIT 1
        `, [toko.id]);
        
        console.log("Gantt for", toko.lingkup_pekerjaan, ":", gantt.rows);
        
        if (gantt.rows.length > 0) {
            const ganttId = gantt.rows[0].id;
            
            const categories = await pool.query(`
                SELECT * FROM kategori_pekerjaan_gantt WHERE id_gantt = $1
            `, [ganttId]);
            console.log("Categories:", categories.rows);
            
            const days = await pool.query(`
                SELECT d.*, k.kategori_pekerjaan
                FROM day_gantt_chart d
                JOIN kategori_pekerjaan_gantt k ON d.id_kategori_pekerjaan_gantt = k.id
                WHERE d.id_gantt = $1
            `, [ganttId]);
            console.log("Days:", days.rows);
            
            const pengawasan = await pool.query(`
                SELECT * FROM pengawasan_gantt WHERE id_gantt = $1
            `, [ganttId]);
            console.log("Pengawasan:", pengawasan.rows);
            
            // Look for missing pengawasan checkpoints
            const pgList = await pool.query(`
                SELECT p.id, p.kategori_pekerjaan, p.jenis_pekerjaan, p.id_pengawasan_gantt, pg.tanggal_pengawasan
                FROM pengawasan p
                JOIN pengawasan_gantt pg ON p.id_pengawasan_gantt = pg.id
                WHERE pg.id_gantt = $1
                AND pg.tanggal_pengawasan = '27/07/2026'
            `, [ganttId]);
            console.log("Pengawasan items for 27/07/2026:", pgList.rows);
        }
    }
    
    process.exit(0);
}

run().catch(console.error);
