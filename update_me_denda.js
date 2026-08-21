const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE opname_final
      SET nilai_denda = 7500000.00, hari_denda = 54
      WHERE id_toko = 1356
      RETURNING id, nilai_denda, hari_denda
    `);
    
    console.log('Updated ME Opname Final:');
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
