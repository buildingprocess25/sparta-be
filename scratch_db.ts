import { pool } from "./src/db/pool";

async function run() {
  try {
    const ulok = "Z001-0709-3333";
    
    console.log("=== RAB ===");
    const rabRes = await pool.query(`SELECT * FROM rab WHERE id_toko IN (SELECT id FROM toko WHERE nomor_ulok = $1)`, [ulok]);
    console.log(JSON.stringify(rabRes.rows, null, 2));

    console.log("\n=== TOKO ===");
    const tokoRes = await pool.query(`SELECT id, nomor_ulok, nama_toko FROM toko WHERE nomor_ulok = $1`, [ulok]);
    console.log(JSON.stringify(tokoRes.rows, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
