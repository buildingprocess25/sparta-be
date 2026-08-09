/**
 * CLEANUP - Hapus semua kategori IL yang sudah diinjeksi oleh migrasi lama (salah range)
 * 
 * Identifikasi: kategori dengan nama prefix format IL yang diinsert
 * ke kategori_pekerjaan_gantt tapi day_gantt_chart-nya menggunakan
 * range dari MIN/MAX gantt lain (bukan dari tanggal IL sendiri).
 *
 * Cara aman: hapus HANYA kategori_pekerjaan_gantt (beserta day_gantt_chart-nya via CASCADE)
 * yang ada di gantt tapi BUKAN berasal dari JSON gantt original (tidak ada di json_pekerjaan).
 * 
 * Lebih spesifik: hapus kpg yang:
 *   1. Ada di kategori_pekerjaan_gantt
 *   2. Kategori tersebut ADA di instruksi_lapangan_item (IL) untuk gantt ini
 *   3. Kategori tersebut TIDAK ada di json_pekerjaan gantt_chart (bukan dari SPK asli)
 */

const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanup() {
  const client = await pool.connect();

  try {
    console.log('=== CLEANUP: Hapus kategori IL yang diinjeksi salah ===\n');

    // Cari semua kpg yang berasal dari IL (ada di IL items) 
    // tapi kategorinya TIDAK ada di JSON gantt asli
    const findQuery = `
      SELECT 
          kpg.id              AS kpg_id,
          kpg.id_gantt,
          kpg.kategori_pekerjaan,
          dgc.id              AS dgc_id,
          dgc.h_awal,
          dgc.h_akhir
      FROM kategori_pekerjaan_gantt kpg
      JOIN gantt_chart gc ON gc.id = kpg.id_gantt
      JOIN toko t ON t.id = gc.id_toko
      LEFT JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
      -- Hanya yang ada di IL items untuk toko ini (berarti diinjeksi oleh migrasi lama)
      WHERE EXISTS (
          SELECT 1
          FROM instruksi_lapangan_item ili
          JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
            AND il.status IN ('Disetujui', 'Approved')
          WHERE il.id_toko = t.id
            AND UPPER(TRIM(ili.kategori_pekerjaan)) = UPPER(TRIM(kpg.kategori_pekerjaan))
      )
      -- Hanya yang TIDAK ada di JSON pekerjaan asli gantt
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
              CASE 
                  WHEN gc.json_pekerjaan IS NULL OR gc.json_pekerjaan = 'null' OR gc.json_pekerjaan = '' THEN '[]'::jsonb
                  ELSE gc.json_pekerjaan::jsonb
              END
          ) AS jp
          WHERE UPPER(TRIM(jp->>'nama_pekerjaan')) = UPPER(TRIM(kpg.kategori_pekerjaan))
             OR UPPER(TRIM(jp->>'kategori')) = UPPER(TRIM(kpg.kategori_pekerjaan))
      )
      ORDER BY kpg.id_gantt, kpg.id
    `;

    const toDelete = await client.query(findQuery);

    if (toDelete.rows.length === 0) {
      console.log('✅ Tidak ada data lama yang perlu dihapus.');
      return;
    }

    console.log(`Ditemukan ${toDelete.rows.length} entri yang akan dihapus:\n`);
    console.table(toDelete.rows.map(r => ({
      kpg_id: r.kpg_id,
      gantt_id: r.id_gantt,
      kategori: r.kategori_pekerjaan,
      dgc_id: r.dgc_id,
      h_awal: r.h_awal,
      h_akhir: r.h_akhir
    })));

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    await new Promise(resolve => {
      rl.question('\nLanjutkan DELETE? (y/N): ', async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          await client.query('BEGIN');
          // Hapus day_gantt_chart dulu, lalu kategori_pekerjaan_gantt
          const kpgIds = [...new Set(toDelete.rows.map(r => r.kpg_id))];
          
          await client.query(`
            DELETE FROM day_gantt_chart 
            WHERE id_kategori_pekerjaan_gantt = ANY($1::int[])
          `, [kpgIds]);

          const delRes = await client.query(`
            DELETE FROM kategori_pekerjaan_gantt 
            WHERE id = ANY($1::int[])
          `, [kpgIds]);

          await client.query('COMMIT');
          console.log(`\n✅ Berhasil hapus ${delRes.rowCount} kategori lama beserta day_gantt_chart-nya.`);
        } else {
          console.log('Dibatalkan.');
        }
        resolve(undefined);
      });
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
