import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
   // Temukan toko yang punya berkas_serah_terima tapi tidak punya opname_final (KTK)
   const query = `
       SELECT t.nomor_ulok, t.lingkup_pekerjaan, b.created_at, b.link_pdf 
       FROM toko t
       JOIN berkas_serah_terima b ON t.id = b.id_toko
       LEFT JOIN opname_final o ON t.id = o.id_toko
       WHERE o.id IS NULL
       ORDER BY b.created_at DESC;
   `;
   const res = await pool.query(query);
   console.log(`Ditemukan ${res.rows.length} proyek migrasi/ST tanpa KTK.`);
   console.log(res.rows.slice(0, 10)); // Tampilkan 10 teratas
}
run().catch(console.error).finally(() => process.exit(0));
