import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
        const result = await client.query(`
            SELECT nomor_spk, waktu_mulai, waktu_selesai, created_at, waktu_persetujuan
            FROM pengajuan_spk
            LIMIT 5;
        `);
        console.table(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
