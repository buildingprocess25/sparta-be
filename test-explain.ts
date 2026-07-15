import { pool } from "./src/db/pool";

async function run() {
    const tokoRes = await pool.query("SELECT id FROM toko ORDER BY id DESC");
    const ids = tokoRes.rows.map(r => r.id);
    const idArr = `{${ids.join(",")}}`;
    
    const rabRes = await pool.query(`SELECT id FROM rab WHERE id_toko = ANY($1::int[])`, [idArr]);
    const rabIds = rabRes.rows.map(r => r.id);
    const rabArr = `{${rabIds.join(",")}}`;
    
    const res = await pool.query(`EXPLAIN (ANALYZE, TIMING OFF) SELECT id, id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan, volume, harga_material, harga_upah, total_material, total_upah, total_harga, catatan FROM rab_item WHERE id_rab = ANY($1::int[]) ORDER BY id ASC`, [rabArr]);
    console.log(res.rows.map(r => r['QUERY PLAN']).join('\n'));
    await pool.end();
}
run().catch(console.error);
