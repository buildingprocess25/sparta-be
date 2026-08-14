import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env specifically if needed, or just use connectionString directly
const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function resetUlokToRab() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    // Start transaction
    await client.query('BEGIN');
    console.log('--- TRANSACTION STARTED ---');
    
    const targetUlok = 'LZ01-2605-L646-R';
    const idSpk = 38;
    const ganttId = 104;

    console.log(`Resetting ULOK: ${targetUlok}`);
    console.log(`Target SPK ID: ${idSpk}`);
    console.log(`Target Gantt ID: ${ganttId}`);

    // 1. Audit Table
    const auditRes = await client.query(
      `DELETE FROM "audit_backfill_target_st_workday_checkpoints_2026_07_20" WHERE "nomor_ulok" = $1 OR "gantt_id" = $2`,
      [targetUlok, ganttId]
    );
    console.log(`Deleted ${auditRes.rowCount} rows from audit_backfill_target_st_workday_checkpoints_2026_07_20`);

    // 2. Pengawasan (depends on gantt)
    const pengawasanRes = await client.query(
      `DELETE FROM "pengawasan" WHERE "id_gantt" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${pengawasanRes.rowCount} rows from pengawasan`);

    // 3. Pengawasan Gantt
    const pengawasanGanttRes = await client.query(
      `DELETE FROM "pengawasan_gantt" WHERE "id_gantt" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${pengawasanGanttRes.rowCount} rows from pengawasan_gantt`);

    // 4. Dependency Gantt
    const depGanttRes = await client.query(
      `DELETE FROM "dependency_gantt" WHERE "id_gantt" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${depGanttRes.rowCount} rows from dependency_gantt`);

    // 5. Kategori Pekerjaan Gantt
    const kategoriGanttRes = await client.query(
      `DELETE FROM "kategori_pekerjaan_gantt" WHERE "id_gantt" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${kategoriGanttRes.rowCount} rows from kategori_pekerjaan_gantt`);

    // 6. Day Gantt Chart
    const dayGanttRes = await client.query(
      `DELETE FROM "day_gantt_chart" WHERE "id_gantt" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${dayGanttRes.rowCount} rows from day_gantt_chart`);

    // 7. Gantt Chart
    const ganttChartRes = await client.query(
      `DELETE FROM "gantt_chart" WHERE "id" = $1`,
      [ganttId]
    );
    console.log(`Deleted ${ganttChartRes.rowCount} rows from gantt_chart`);

    // 8. PIC Pengawasan
    const picRes = await client.query(
      `DELETE FROM "pic_pengawasan" WHERE "id_spk" = $1 AND "nomor_ulok" = $2`,
      [idSpk, targetUlok]
    );
    console.log(`Deleted ${picRes.rowCount} rows from pic_pengawasan`);

    // 9. Pengajuan SPK
    const spkRes = await client.query(
      `DELETE FROM "pengajuan_spk" WHERE "id" = $1 AND "nomor_ulok" = $2`,
      [idSpk, targetUlok]
    );
    console.log(`Deleted ${spkRes.rowCount} rows from pengajuan_spk`);

    // Commit Transaction
    await client.query('COMMIT');
    console.log('--- TRANSACTION COMMITTED SUCCESSFULLY ---');

  } catch (err) {
    console.error('Error during deletion, ROLLING BACK!', err);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

resetUlokToRab().catch(console.error);
