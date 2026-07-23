import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
   const tokos = await pool.query(`SELECT id, nomor_ulok, lingkup_pekerjaan FROM toko WHERE nomor_ulok = 'UZ01-2602-0012'`);
   if (tokos.rows.length > 0) {
       for (const toko of tokos.rows) {
           await pool.query(
               `UPDATE berkas_serah_terima SET created_at = '2026-05-19 00:00:00' WHERE id_toko = $1`,
               [toko.id]
           );
           console.log(`Updated ST date for ${toko.nomor_ulok} ${toko.lingkup_pekerjaan} (id_toko: ${toko.id}) to 19 May 2026`);
       }
   } else {
       console.log("No tokos found");
   }
}
run().catch(console.error).finally(() => process.exit(0));
