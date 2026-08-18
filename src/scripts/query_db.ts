import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
    const res = await client.query("SELECT nomor_ulok, STRING_AGG(DISTINCT lingkup_pekerjaan, ' + ' ORDER BY lingkup_pekerjaan DESC) AS lingkup_pekerjaan FROM toko WHERE nomor_ulok = 'Z001-2512-4444' GROUP BY nomor_ulok");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
