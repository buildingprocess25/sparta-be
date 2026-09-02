import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: "postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable",
  });

  try {
    await client.connect();
    console.log("Connected to database");

    const ulok = "UZ01-2605-0030";
    const idPengawasanGantt = 4364;

    console.log(`\n--- Checking Toko and Gantt Chart for ULOK ${ulok} ---`);
    const tokoGanttQuery = await client.query(`
      SELECT t.id as id_toko, t.nomor_ulok, g.id as id_gantt, t.proyek
      FROM toko t
      JOIN gantt_chart g ON g.id_toko = t.id
      WHERE t.nomor_ulok = $1
    `, [ulok]);
    console.table(tokoGanttQuery.rows);

    const idGantt = tokoGanttQuery.rows[0]?.id_gantt;

    console.log(`\n--- Checking pengawasan_gantt for id_pengawasan_gantt ${idPengawasanGantt} ---`);
    const pgGanttQuery = await client.query(`
      SELECT * FROM pengawasan_gantt
      WHERE id = $1
    `, [idPengawasanGantt]);
    console.table(pgGanttQuery.rows);

    console.log(`\n--- Checking berkas_pengawasan for id_pengawasan_gantt ${idPengawasanGantt} ---`);
    const berkasQuery = await client.query(`
      SELECT * FROM berkas_pengawasan
      WHERE id_pengawasan_gantt = $1
    `, [idPengawasanGantt]);
    console.log(JSON.stringify(berkasQuery.rows, null, 2));

    // Let's also check if there is any other pengawasan_gantt for this id_gantt
    if (idGantt) {
        console.log(`\n--- Checking ALL pengawasan_gantt for id_gantt ${idGantt} ---`);
        const allPgGanttQuery = await client.query(`
          SELECT id, tanggal_pengawasan, status
          FROM pengawasan_gantt
          WHERE id_gantt = $1
          ORDER BY tanggal_pengawasan ASC
        `, [idGantt]);
        console.table(allPgGanttQuery.rows);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

main();
