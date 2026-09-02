const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable',
  });

  try {
    await client.connect();
    
    // 1. Get id_toko and id_gantt
    const tokoRes = await client.query(`
      SELECT g.id, g.id_toko 
      FROM gantt_chart g
      JOIN toko t ON g.id_toko = t.id
      WHERE t.nomor_ulok = '1YZ1-2606-1YW3-R'
    `);
    const idGantt = tokoRes.rows[0].id;

    // 2. Get id_pengawasan_gantt for 21/08 and 27/08
    const pg21Res = await client.query(`SELECT id FROM pengawasan_gantt WHERE id_gantt = $1 AND tanggal_pengawasan = '21/08/2026'`, [idGantt]);
    const idPg21 = pg21Res.rows[0]?.id;

    const pg27Res = await client.query(`SELECT id FROM pengawasan_gantt WHERE id_gantt = $1 AND tanggal_pengawasan = '27/08/2026'`, [idGantt]);
    let idPg27 = pg27Res.rows[0]?.id;

    if (idPg21 && idPg27) {
        const items21Res = await client.query(`SELECT * FROM pengawasan WHERE id_pengawasan_gantt = $1 AND status = 'terlambat'`, [idPg21]);
        
        // Group by key, taking the latest (by id or created_at)
        const items21Map = new Map();
        for (let row of items21Res.rows) {
            let key = row.kategori_pekerjaan + '|' + row.jenis_pekerjaan;
            // If there's a duplicate, keep the one with the higher ID
            if (!items21Map.has(key) || items21Map.get(key).id < row.id) {
                items21Map.set(key, row);
            }
        }

        const items27Res = await client.query(`SELECT kategori_pekerjaan, jenis_pekerjaan FROM pengawasan WHERE id_pengawasan_gantt = $1`, [idPg27]);
        const keys27 = new Set(items27Res.rows.map(r => r.kategori_pekerjaan + '|' + r.jenis_pekerjaan));

        const itemsToInsert = [];
        for (let [key, row] of items21Map.entries()) {
            if (!keys27.has(key)) {
                itemsToInsert.push(row);
            }
        }

        console.log("Found " + itemsToInsert.length + " items to repair/insert.");
        
        for (let item of itemsToInsert) {
            console.log("Inserting: " + item.kategori_pekerjaan + " - " + item.jenis_pekerjaan);
            const insertQuery = `
                INSERT INTO pengawasan (
                    id_gantt,
                    id_pengawasan_gantt, 
                    kategori_pekerjaan, 
                    jenis_pekerjaan, 
                    status, 
                    catatan, 
                    dokumentasi, 
                    dokumentasi_base64
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
            `;
            const values = [
                idGantt,
                idPg27,
                item.kategori_pekerjaan,
                item.jenis_pekerjaan,
                'terlambat',
                null, // No old notes
                null, // No old photo
                null  // No old photo
            ];
            const res = await client.query(insertQuery, values);
            console.log("Inserted with ID:", res.rows[0].id);
        }
        
        console.log("Repair finished.");
    }

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
