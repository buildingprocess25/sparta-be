require('dotenv').config({path: '../sparta-be.env'});
const pool = require('./src/db/pool').pool;

async function run() {
  try {
    await pool.query('UPDATE dc_archive_project SET branch_name = $1 WHERE branch_name IN ($2, $3)', ['BALARAJA', 'BALARAJA1', 'BALARAJA2']);
    await pool.query('UPDATE dc_archive_project SET branch_name = $1 WHERE branch_name = $2', ['BANDUNG', 'BANDUNG2']);
    await pool.query('UPDATE dc_archive_project SET branch_name = $1 WHERE archive_name = $2', ['SIDOARJO', 'WHC BEREBEK']);
    console.log('Updated DB');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
