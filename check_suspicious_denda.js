const { Pool } = require('pg');
require('dotenv').config({ path: './sparta-be.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  // ULOK yang naik denda: toko 1260 (OZ01), 1297 (2VZ1), 1427 (1MZ1), 1868 (WZ01)
  const tokoIds = [1260, 1261, 1297, 1298, 1427, 1428, 1868, 1869];

  const res = await pool.query(`
    SELECT 
      t.id as id_toko,
      t.nomor_ulok,
      t.lingkup_pekerjaan,
      ps.waktu_selesai           AS akhir_spk_asli,
      pt_max.tgl_perpanjangan    AS akhir_spk_perpanjangan,
      bst.created_at             AS tanggal_st,
      ofn.hari_denda             AS hari_denda_db
    FROM toko t
    LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id 
      AND UPPER(TRIM(COALESCE(ps.status,''))) IN ('SPK_APPROVED','APPROVED','DISETUJUI','AKTIF','ACTIVE','SELESAI')
    LEFT JOIN LATERAL (
      SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) AS tgl_perpanjangan
      FROM pertambahan_spk pt 
      WHERE pt.id_spk = ps.id
        AND UPPER(TRIM(COALESCE(pt.status_persetujuan,''))) IN ('APPROVED','DISETUJUI','DISETUJUI BM')
    ) pt_max ON true
    LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
    LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
    WHERE t.id = ANY($1)
    ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, t.id
  `, [tokoIds]);

  console.log('\n=== SUSPICIOUS DENDA - CHECK SPK & ST DATA ===\n');
  for (const row of res.rows) {
    const akhirSpk = row.akhir_spk_perpanjangan || row.akhir_spk_asli;
    console.log(`Toko ${row.id_toko} [${row.nomor_ulok}/${row.lingkup_pekerjaan}]`);
    console.log(`  Akhir SPK   : ${akhirSpk ?? 'NULL'}`);
    console.log(`  Tanggal ST  : ${row.tanggal_st ?? 'NULL (belum ada ST)'}`);
    console.log(`  Denda di DB : ${row.hari_denda_db ?? 0} hari`);
    console.log('');
  }

  await pool.end();
}

main().catch(console.error);
