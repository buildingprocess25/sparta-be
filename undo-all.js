const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const logContent = fs.readFileSync('C:/Users/tezow/.gemini/antigravity-ide/brain/382e52f3-13bb-4ec4-83a0-21b730f885bf/.system_generated/tasks/task-896.log', 'utf-8');
  const lines = logContent.split('\n');

  const client = await pool.connect();
  await client.query('BEGIN');
  console.log('--- UNDO FIX-IL-PREFIX ---');
  let count = 0;

  for (const line of lines) {
    // [H168] Gantt 29 | "PEKERJAAN TAMBAHAN" → "[IL] PEKERJAAN TAMBAHAN" | hari 47-60 → 47-60
    const m = line.match(/Gantt\s+(\d+)\s+\|\s+"([^"]+)"\s+[^"]+"\s*\[IL\]\s+([^"]+)"\s+\|\s+hari\s+(\d+)-(\d+)/);
    if (m) {
      const ganttId = m[1];
      const oldName = m[2];
      const newName = `[IL] ${m[3]}`;
      const oldAwal = m[4];
      const oldAkhir = m[5];

      // Update name back to oldName
      const kpgRes = await client.query(`
        UPDATE kategori_pekerjaan_gantt
        SET kategori_pekerjaan = $1
        WHERE id_gantt = $2 AND kategori_pekerjaan = $3
        RETURNING id
      `, [oldName, ganttId, newName]);

      if (kpgRes.rows.length > 0) {
        const kpgId = kpgRes.rows[0].id;
        // Update days back to oldAwal, oldAkhir
        await client.query(`
          UPDATE day_gantt_chart
          SET h_awal = $1, h_akhir = $2
          WHERE id_kategori_pekerjaan_gantt = $3
        `, [oldAwal, oldAkhir, kpgId]);
        count++;
      }
    }
  }

  console.log(`Restored ${count} kpg from fix-il-prefix.`);
  
  console.log('\n--- UNDO ROLLBACK.JS (23 ITEMS) ---');
  const rollbackOutput = `
[HE23] Gantt 41 | "PEKERJAAN PONDASI & BETON" | 34-61 -> 6-33
[HE23] Gantt 41 | "PEKERJAAN BESI" | 34-61 -> 6-33
[2V97] Gantt 113 | "PEKERJAAN TAMBAHAN" | 49-52 -> 43-46
[2S97] Gantt 114 | "PEKERJAAN PLUMBING" | 32-54 -> 18-40
[2VA2] Gantt 126 | "PEKERJAAN TAMBAHAN" | 34-83 -> 1-50
[2VA2] Gantt 126 | "PEKERJAAN SANITARY & ACECORIES" | 34-83 -> 1-50
[-] Gantt 136 | "PEKERJAAN TAMBAHAN" | 45-51 -> 12-18
[2S94] Gantt 174 | "PEKERJAAN FINISHING" | 46-50 -> 39-43
[BJ49] Gantt 436 | "PEKERJAAN BOBOKAN / BONGKARAN" | 22-76 -> 1-55
[2S99] Gantt 543 | "PEKERJAAN AREA TERBUKA" | 42-49 -> 34-41
[2SA5] Gantt 605 | "PEKERJAAN KERAMIK" | 9-48 -> 1-40
[2SA5] Gantt 605 | "PEKERJAAN TAMBAHAN" | 9-48 -> 1-40
[XC40] Gantt 698 | "Fixture" | 88-88 -> 86-86
[X956] Gantt 708 | "Pekerjaan Tambahan" | 132-132 -> 79-79
[XC41] Gantt 784 | "Instalasi" | 82-82 -> 50-50
[1SLH] Gantt 969 | "Pekerjaan Pasangan" | 29-67 -> 26-64
[UF68] Gantt 1029 | "Fixture" | 65-65 -> 63-63
[UF75] Gantt 1040 | "Instalasi" | 61-61 -> 61-61
[2AFO] Gantt 1094 | "Instalasi" | 57-57 -> 43-43
[UF84] Gantt 1381 | "INSTALASI" | 26-26 -> 22-22
[UF84] Gantt 1383 | "PEKERJAAN PASANGAN" | 26-26 -> 22-22
[UF84] Gantt 1383 | "PEKERJAAN BESI" | 26-26 -> 22-22
[UF70] Gantt 1438 | "PEKERJAAN TAMBAHAN" | 3-27 -> 1-25
  `;

  let rCount = 0;
  for (const line of rollbackOutput.split('\n')) {
    const m = line.match(/Gantt\s+(\d+)\s+\|\s+"([^"]+)"\s+\|\s+(\d+)-(\d+)/);
    if (m) {
      const ganttId = m[1];
      const name = m[2];
      const oldAwal = m[3];
      const oldAkhir = m[4];

      const kpgRes = await client.query(`
        SELECT id FROM kategori_pekerjaan_gantt
        WHERE id_gantt = $1 AND kategori_pekerjaan = $2
      `, [ganttId, name]);

      if (kpgRes.rows.length > 0) {
        const kpgId = kpgRes.rows[0].id;
        await client.query(`
          UPDATE day_gantt_chart
          SET h_awal = $1, h_akhir = $2
          WHERE id_kategori_pekerjaan_gantt = $3
        `, [oldAwal, oldAkhir, kpgId]);
        rCount++;
      }
    }
  }
  console.log(`Restored ${rCount} kpg from rollback.js.`);

  await client.query('COMMIT');
  client.release();
  await pool.end();
}
run();
