const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
async function run() {
  await client.connect();
  
  try {
    await client.query("BEGIN");
    
    // We update opname_final for id_toko 2509 and 2510
    // Setting aksi = 'active', status_opname_final = 'Ditolak oleh Koordinator'
    // This allows the contractor to "Revisi" the KTK
    const res = await client.query(`
      UPDATE opname_final
      SET 
          aksi = 'active',
          status_opname_final = 'Ditolak oleh Koordinator',
          alasan_penolakan = 'Penyesuaian untuk input item IL baru',
          pemberi_persetujuan_koordinator = NULL,
          waktu_persetujuan_koordinator = NULL,
          pemberi_persetujuan_manager = NULL,
          waktu_persetujuan_manager = NULL,
          pemberi_persetujuan_direktur = NULL,
          waktu_persetujuan_direktur = NULL
      WHERE id_toko IN (2509, 2510)
      RETURNING id, id_toko, status_opname_final, aksi;
    `);
    
    console.log('Opname Final updated:', res.rows);
    
    await client.query("COMMIT");
    console.log("Successfully unlocked KTK for 2JZ1-2403-0001-R");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error unlocking KTK:", err);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
