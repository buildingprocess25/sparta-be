const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable',
  });

  try {
    await client.connect();

    console.log("=== TOKO ===");
    const tokoRes = await client.query(`SELECT id, nomor_ulok, nama_toko FROM toko WHERE nomor_ulok LIKE '%2AZ1-2605-0009%'`);
    console.table(tokoRes.rows);

    const tokoIds = tokoRes.rows.map(r => r.id);

    if (tokoIds.length > 0) {
      console.log("\n=== UPDATING SPK ===");
      await client.query(`
        UPDATE pengajuan_spk
        SET 
          nomor_ulok = '2AZ1-2605-0009',
          proyek = 'Reguler',
          alasan_penolakan = NULL
        WHERE id IN (1168, 1169)
      `);

      await client.query(`
        UPDATE pengajuan_spk
        SET 
          grand_total = '484515000.00',
          terbilang = '( Empat Ratus Delapan Puluh Empat Juta Lima Ratus Lima Belas Ribu Rupiah )'
        WHERE id = 1168
      `);

      console.log("\n=== AFTER SPK UPDATE ===");
      const spkResAfter = await client.query(`SELECT id, id_toko, status, proyek, nomor_ulok, grand_total, terbilang FROM pengajuan_spk WHERE id IN (1168, 1169)`);
      console.log(spkResAfter.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
