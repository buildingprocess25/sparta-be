import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
   const res = await pool.query(`SELECT * FROM toko WHERE nomor_ulok = 'UZ01-2602-0012'`);
   console.log("Tokos:", JSON.stringify(res.rows, null, 2));
   if (res.rows.length > 0) {
       const st = await pool.query(`SELECT * FROM berkas_serah_terima WHERE id_toko = ANY($1)`, [res.rows.map((r: any) => r.id)]);
       console.log("ST:", JSON.stringify(st.rows, null, 2));
       const opname = await pool.query(`SELECT * FROM opname_final WHERE id_toko = ANY($1)`, [res.rows.map((r: any) => r.id)]);
       console.log("Opname:", JSON.stringify(opname.rows, null, 2));
       const spk = await pool.query(`SELECT * FROM spk WHERE id_toko = ANY($1)`, [res.rows.map((r: any) => r.id)]);
       console.log("SPK:", JSON.stringify(spk.rows, null, 2));
   }
}
run().catch(console.error).finally(() => process.exit(0));
