/**
 * MIGRASI IL → GANTT
 *
 * Tujuan: INSERT kategori IL yang belum ada di Gantt Chart.
 *
 * Formula range (sama dengan logika frontend page.tsx):
 *   h_awal  = (il.tanggal_mulai  - gantt.timestamp) + 1
 *   h_akhir = (il.tanggal_selesai - gantt.timestamp) + 1
 *
 * Referensi "hari ke-1" = gantt_chart.timestamp
 * (frontend menggunakan gantt.timestamp sebagai projectStart)
 *
 * Aturan: HANYA INSERT, tidak pernah UPDATE yang sudah ada.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTCDate(d) {
  const dt = new Date(d);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function calcRange(ganttTimestamp, ilMulai, ilSelesai) {
  const ref   = toUTCDate(ganttTimestamp);
  const start = toUTCDate(ilMulai);
  const end   = toUTCDate(ilSelesai);
  const hAwal  = Math.max(1, Math.round((start - ref) / MS_PER_DAY) + 1);
  const hAkhir = Math.max(hAwal, Math.round((end - ref) / MS_PER_DAY) + 1);
  return { hAwal, hAkhir };
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== MIGRASI IL → GANTT (INSERT ONLY, referensi dari gantt.timestamp) ===\n');
    await client.query('BEGIN');

    const res = await client.query(`
      SELECT DISTINCT
          g.id                                AS gantt_id,
          g.timestamp                         AS gantt_ts,
          UPPER(TRIM(ili.kategori_pekerjaan)) AS kategori,
          il.tanggal_mulai                    AS il_mulai,
          il.tanggal_selesai                  AS il_selesai
      FROM instruksi_lapangan_item ili
      JOIN instruksi_lapangan il
          ON il.id = ili.id_instruksi_lapangan
         AND il.status IN ('Disetujui', 'Approved')
      JOIN toko t ON t.id = il.id_toko
      JOIN gantt_chart g ON g.id_toko = t.id
      WHERE il.tanggal_mulai   IS NOT NULL
        AND il.tanggal_selesai IS NOT NULL
        AND g.timestamp        IS NOT NULL
        -- HANYA yang belum ada (cek hanya dengan prefix [IL], agar terpisah dari item RAB)
        AND NOT EXISTS (
            SELECT 1 FROM kategori_pekerjaan_gantt kpg
            WHERE kpg.id_gantt = g.id
              AND UPPER(TRIM(kpg.kategori_pekerjaan)) = '[IL] ' || UPPER(TRIM(ili.kategori_pekerjaan))
        )
    `);

    if (res.rows.length === 0) {
      console.log('✅ Tidak ada kategori IL yang hilang dari Gantt.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`Ditemukan ${res.rows.length} kategori IL yang belum ada.\n`);

    let inserted = 0;
    for (const row of res.rows) {
      const { gantt_id, gantt_ts, kategori, il_mulai, il_selesai } = row;
      const { hAwal, hAkhir } = calcRange(gantt_ts, il_mulai, il_selesai);

      // Simpan dengan prefix [IL] supaya jelas beda dari item RAB
      const ilName = `[IL] ${kategori}`;

      const kpg = await client.query(`
        INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
        VALUES ($1, $2) RETURNING id
      `, [gantt_id, ilName]);

      await client.query(`
        INSERT INTO day_gantt_chart (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
        VALUES ($1, $2, $3, $4, NULL, NULL)
      `, [gantt_id, kpg.rows[0].id, String(hAwal), String(hAkhir)]);

      console.log(`[INSERT] Gantt ${gantt_id} | "${ilName}" | hari ${hAwal}-${hAkhir}`);
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Selesai! ${inserted} kategori IL baru diinjeksi ke Gantt.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR - ROLLBACK:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
