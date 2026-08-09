const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const transcriptPath = 'C:/Users/tezow/.gemini/antigravity-ide/brain/382e52f3-13bb-4ec4-83a0-21b730f885bf/.system_generated/logs/transcript_full.jsonl';
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');

  const inserted = new Set();
  
  for (const line of lines) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.content) {
        const matches = parsed.content.matchAll(/\[INSERT\] Gantt (\d+) \| "([^"]+)"/g);
        for (const m of matches) {
          const ganttId = m[1];
          const name = m[2];
          // We only care about the ones inserted WITHOUT [IL] prefix
          if (!name.startsWith('[IL]')) {
            inserted.add(`${ganttId}|${name}`);
          }
        }
      }
    } catch(e) {}
  }

  console.log(`Found ${inserted.size} unique bad insertions without [IL] prefix from the transcript.`);
  
  if (inserted.size === 0) {
    console.log("No bad insertions found.");
    process.exit(0);
  }

  const client = await pool.connect();
  await client.query('BEGIN');
  
  let deleted = 0;
  for (const item of inserted) {
    const [ganttId, name] = item.split('|');
    const kpgRes = await client.query(`
      SELECT id FROM kategori_pekerjaan_gantt
      WHERE id_gantt = $1 AND kategori_pekerjaan = $2
      ORDER BY id DESC LIMIT 1
    `, [ganttId, name]);

    if (kpgRes.rows.length > 0) {
      const kpgId = kpgRes.rows[0].id;
      // Because we inserted them today, their ID should be high (> 19000). 
      // This prevents us from deleting an original RAB item that happened to have the same name.
      // Wait, if it's a BAD insert, it MUST have a high ID!
      if (kpgId > 19000) {
        // Double check no keterlambatan
        const dgcRes = await client.query(`
          SELECT keterlambatan FROM day_gantt_chart
          WHERE id_kategori_pekerjaan_gantt = $1
        `, [kpgId]);
        
        const hasKeterlambatan = dgcRes.rows.length > 0 && dgcRes.rows[0].keterlambatan != null && dgcRes.rows[0].keterlambatan !== '';
        
        if (!hasKeterlambatan) {
          await client.query(`DELETE FROM day_gantt_chart WHERE id_kategori_pekerjaan_gantt = $1`, [kpgId]);
          await client.query(`DELETE FROM kategori_pekerjaan_gantt WHERE id = $1`, [kpgId]);
          console.log(`Deleted bad insert: Gantt ${ganttId} | ${name} (ID: ${kpgId})`);
          deleted++;
        }
      }
    }
  }

  console.log(`Successfully deleted ${deleted} bad insertions.`);
  await client.query('COMMIT');
  client.release();
  await pool.end();
}

run();
