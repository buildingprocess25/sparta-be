import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
   const tokos = await pool.query(`SELECT id, lingkup_pekerjaan FROM toko WHERE nomor_ulok = 'UZ01-2602-0010'`);
   console.log(tokos.rows);
}
run().catch(console.error).finally(() => process.exit(0));
