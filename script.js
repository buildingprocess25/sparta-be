const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
async function run() {
  await client.connect();
  const toko = await client.query('SELECT * FROM toko WHERE nomor_ulok = $1', ['LZ01-2511-0003']);
  console.log('Toko:', toko.rows[0]);
  if(toko.rows.length > 0) {
    const id_toko = toko.rows[0].id;
    const rab = await client.query('SELECT * FROM rab WHERE id_toko = $1', [id_toko]);
    console.log('RAB:', rab.rows);
    if(rab.rows.length > 0) {
      const id_rab = rab.rows[0].id;
      const rab_items = await client.query('SELECT * FROM rab_item WHERE id_rab = $1', [id_rab]);
      console.log('RAB Items Count:', rab_items.rows.length);
      console.log('RAB Items with - :', rab_items.rows.filter(r => r.jenis_pekerjaan === '-' || !r.jenis_pekerjaan || r.volume == 0 || r.kategori_pekerjaan === 'LAINNYA'));
      
      const opname_items = await client.query('SELECT * FROM opname_item WHERE id_toko = $1', [id_toko]);
      console.log('Opname Items Count:', opname_items.rows.length);
      console.log('Opname Items with opname final id (null check):', opname_items.rows.filter(o => o.id_opname_final !== null).length);

      const il_items = await client.query('SELECT * FROM instruksi_lapangan_item WHERE id_instruksi_lapangan IN (SELECT id FROM instruksi_lapangan WHERE id_toko = $1)', [id_toko]);
      console.log('IL Items:', il_items.rows);
    }
  }
  await client.end();
}
run().catch(console.error);
