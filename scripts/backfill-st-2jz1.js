const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { execSync } = require('child_process');

dotenv.config({ path: path.resolve(__dirname, '../../sparta-be.env') });

async function backfillSerahTerima() {
  let pool = null;
  let client = null;

  try {
    const url = new URL(process.env.DATABASE_URL);
    const connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false }
    };
    
    pool = new Pool(connectionConfig);
    client = await pool.connect();

    console.log('Backfilling Serah Terima for 2JZ1-2603-0003 (Sipil, id_toko=1226)');
    
    const opname = await client.query('SELECT id FROM opname_final WHERE id_toko = 1226');
    if(opname.rows.length === 0) {
      console.log('Opname Final untuk Sipil belum dibuat. Silahkan migrasi di UI dulu.');
      return;
    }

    // Since we know the application logic handles PDF generation via a service method:
    // Let's call the NestJS script equivalent or make a simple HTTP request to a local backfill endpoint if it exists,
    // Or we can just insert the record in berkas_serah_terima and then the system might auto-generate it.
    // Wait, the easiest way is to use curl to the internal API, or just insert it and we can use the existing background job.
    // Actually, `serahTerimaService.createPdfSerahTerima(1226)` generates it.
    // Let's just create a quick ts-node script that calls that service.
  } catch(e) {
    console.error('Error:', e);
  } finally {
    if(client) client.release();
    if(pool) await pool.end();
  }
}

backfillSerahTerima();
