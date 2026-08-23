const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT p.id, p.status, p.kategori_pekerjaan, p.jenis_pekerjaan
            FROM pengawasan p
            JOIN gantt_chart gc ON gc.id = p.id_gantt
            JOIN toko t ON t.id = gc.id_toko
            WHERE t.nomor_ulok = 'Z001-3007-0102-R'
              AND p.kategori_pekerjaan = 'PEKERJAAN SANITARY & ACECORIES'
        `);
        console.table(res.rows);
        
        const rabRes = await pool.query(`
            SELECT ri.kategori_pekerjaan, ri.jenis_pekerjaan
            FROM rab_item ri
            JOIN rab r ON r.id = ri.id_rab
            JOIN toko t ON t.id = r.id_toko
            WHERE t.nomor_ulok = 'Z001-3007-0102-R'
              AND ri.kategori_pekerjaan ILIKE '%sanitary%'
        `);
        console.table(rabRes.rows);

        const normalize = (val) => String(val || '').trim().replace(/\[IL\]\s*/gi, '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').toUpperCase();
        
        console.log("Pengawasan normalized 0:", normalize(res.rows[1].jenis_pekerjaan));
        console.log("RAB normalized 0:", normalize(rabRes.rows[0].jenis_pekerjaan));
        console.log("Match?", normalize(res.rows[1].jenis_pekerjaan) === normalize(rabRes.rows[0].jenis_pekerjaan));
        
    } finally {
        await pool.end();
    }
}

main();
