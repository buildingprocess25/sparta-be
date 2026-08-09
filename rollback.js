/**
 * RESTORE: Set ulang h_awal/h_akhir untuk 23 entri pre-existing yang sempat diubah
 * oleh migrasi v2/v3 yang salah.
 *
 * Formula: (IL tanggal_mulai/selesai - SPK waktu_mulai) + 1
 */

const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MS_PER_DAY = 24 * 60 * 60 * 1000;
function toUTC(d) {
  const dt = new Date(d);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

async function restore() {
  const client = await pool.connect();
  try {
    console.log('=== RESTORE: Hitung ulang range 23 entri dari SPK ===\n');
    await client.query('BEGIN');

    // Ambil entri dengan keterlambatan terisi + namanya ada di IL
    // Sekaligus hitung range yang benar dari SPK
    const res = await client.query(`
      SELECT
          dgc.id        AS dgc_id,
          kpg.id_gantt,
          kpg.kategori_pekerjaan,
          dgc.h_awal    AS h_awal_skrg,
          dgc.h_akhir   AS h_akhir_skrg,
          dgc.keterlambatan,
          t.kode_toko,
          -- IL terbaru approved untuk toko ini dengan kategori yg sama
          il.tanggal_mulai  AS il_mulai,
          il.tanggal_selesai AS il_selesai,
          spk.waktu_mulai   AS spk_mulai
      FROM kategori_pekerjaan_gantt kpg
      JOIN gantt_chart g ON g.id = kpg.id_gantt
      JOIN toko t ON t.id = g.id_toko
      JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
      -- IL terbaru approved yang punya kategori sama
      JOIN LATERAL (
          SELECT il.tanggal_mulai, il.tanggal_selesai
          FROM instruksi_lapangan_item ili
          JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
            AND il.status IN ('Disetujui', 'Approved')
          WHERE il.id_toko = t.id
            AND UPPER(TRIM(ili.kategori_pekerjaan)) = UPPER(TRIM(kpg.kategori_pekerjaan))
            AND il.tanggal_mulai IS NOT NULL
            AND il.tanggal_selesai IS NOT NULL
          ORDER BY il.id DESC LIMIT 1
      ) il ON true
      -- SPK terbaru
      JOIN LATERAL (
          SELECT waktu_mulai FROM pengajuan_spk
          WHERE id_toko = t.id ORDER BY id DESC LIMIT 1
      ) spk ON true
      WHERE dgc.keterlambatan IS NOT NULL
        AND dgc.keterlambatan <> ''
        AND dgc.keterlambatan <> '0'
      ORDER BY kpg.id_gantt, kpg.id
    `);

    console.log(`Ditemukan ${res.rows.length} entri yang akan di-restore.\n`);

    let updated = 0;
    for (const row of res.rows) {
      const { dgc_id, id_gantt, kategori_pekerjaan, h_awal_skrg, h_akhir_skrg, kode_toko, il_mulai, il_selesai, spk_mulai } = row;

      const spkUTC   = toUTC(spk_mulai);
      const ilStartUTC = toUTC(il_mulai);
      const ilEndUTC   = toUTC(il_selesai);

      const hAwal  = Math.max(1, Math.round((ilStartUTC - spkUTC) / MS_PER_DAY) + 1);
      const hAkhir = Math.max(hAwal, Math.round((ilEndUTC - spkUTC) / MS_PER_DAY) + 1);

      console.log(`[${kode_toko}] Gantt ${id_gantt} | "${kategori_pekerjaan}" | ${h_awal_skrg}-${h_akhir_skrg} → ${hAwal}-${hAkhir}`);

      await client.query(`
        UPDATE day_gantt_chart SET h_awal = $1, h_akhir = $2 WHERE id = $3
      `, [String(hAwal), String(hAkhir), dgc_id]);

      updated++;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Selesai! ${updated} entri berhasil di-restore.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR - ROLLBACK:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

restore();
