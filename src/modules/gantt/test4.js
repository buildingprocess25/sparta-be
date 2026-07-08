const { pool } = require('../../db/pool');

async function test() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%gantt%'");
    console.log(res.rows.map(r=>r.table_name));
  } finally {
    pool.end();
  }
}
test();
