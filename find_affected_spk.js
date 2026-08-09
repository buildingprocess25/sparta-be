const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

(async () => {
  try {
    await client.connect();
    
    const query = `
      WITH LatestRab AS (
        SELECT DISTINCT ON (id_toko) id_toko, grand_total_final::numeric
        FROM rab
        WHERE status = 'Disetujui'
        ORDER BY id_toko, created_at DESC
      )
      SELECT 
        s.id AS spk_id,
        t.nomor_ulok,
        t.cabang,
        t.nama_toko,
        t.lingkup_pekerjaan,
        r.grand_total_final AS rab_total,
        s.grand_total AS spk_total,
        s.created_at AS spk_created_at
      FROM pengajuan_spk s
      JOIN toko t ON s.id_toko = t.id
      JOIN LatestRab r ON r.id_toko = t.id
      WHERE 
        s.grand_total != r.grand_total_final
        AND s.grand_total = FLOOR(r.grand_total_final / 10000) * 10000
        AND t.nomor_ulok != 'WZ01-2512-0002'
      ORDER BY s.created_at DESC;
    `;
    
    const res = await client.query(query);
    
    console.log(`Found ${res.rows.length} cases with similar discrepancies:\n`);
    res.rows.forEach(row => {
      console.log(`- ULOK: ${row.nomor_ulok} | SPK ID: ${row.spk_id} | Cabang: ${row.cabang}`);
      console.log(`  Lingkup: ${row.lingkup_pekerjaan}`);
      console.log(`  RAB Total: ${row.rab_total}`);
      console.log(`  SPK Total: ${row.spk_total}`);
      console.log(`  Created  : ${row.spk_created_at}`);
      console.log(`--------------------------------------------------`);
    });
    
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
})();
