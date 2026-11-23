const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable",
});

async function run() {
  try {
    const resFinal = await pool.query("SELECT id, id_toko FROM opname_final ORDER BY id DESC LIMIT 1");
    if (resFinal.rows.length === 0) return console.log("No opname final found");
    const opnameFinal = resFinal.rows[0];

    const resIN = await pool.query(`
        SELECT 
            oi.id, 
            oi.id_toko, 
            ri.kategori_pekerjaan, 
            ri.jenis_pekerjaan, 
            oi.foto as original_foto,
            latest_pengawasan.dokumentasi,
            COALESCE(NULLIF(oi.foto, ''), latest_pengawasan.dokumentasi, latest_pengawasan.dokumentasi_base64) AS final_foto
        FROM opname_item oi
        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
        LEFT JOIN LATERAL (
            SELECT p.dokumentasi, p.dokumentasi_base64, p.kategori_pekerjaan, p.jenis_pekerjaan
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE p.id_gantt IN (
                SELECT g.id
                FROM gantt_chart g
                WHERE g.id_toko = oi.id_toko
            )
              AND UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, '')))
              AND UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, '')))
            ORDER BY to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
            LIMIT 1
        ) latest_pengawasan ON true
        WHERE oi.id_opname_final = $1
        LIMIT 5
    `, [opnameFinal.id]);
    
    console.log(resIN.rows);

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
