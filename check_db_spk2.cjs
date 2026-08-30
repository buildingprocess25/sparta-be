const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function run() {
    await client.connect();
    
    try {
        const rabQuery = `
            SELECT r.*, t.kode_toko, t.nama_toko
            FROM rab r
            LEFT JOIN toko t ON r.id_toko = t.id
            WHERE t.nomor_ulok = 'MZ01-2607-M570-R' OR t.kode_toko = 'M570'
            ORDER BY r.created_at DESC
            LIMIT 5;
        `;
        const rabRes = await client.query(rabQuery);
        console.log("Pengajuan RAB:");
        console.log(JSON.stringify(rabRes.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
