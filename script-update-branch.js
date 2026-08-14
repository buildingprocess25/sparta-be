require('dotenv').config({path: '../sparta-be.env'});
const pool = require('./src/db/pool').pool;

async function run() {
  try {
    const res = await pool.query('SELECT id, archive_name, branch_name FROM dc_archive_project');
    let updated = 0;
    for (const row of res.rows) {
      let newBranch = row.archive_name;
      if (newBranch.startsWith('DC ')) newBranch = newBranch.replace('DC ', '');
      else if (newBranch.startsWith('WH ')) newBranch = newBranch.replace('WH ', '');
      
      newBranch = newBranch.trim().toUpperCase();

      if (row.branch_name !== newBranch) {
        await pool.query('UPDATE dc_archive_project SET branch_name = $1 WHERE id = $2', [newBranch, row.id]);
        console.log(`Updated ID ${row.id}: ${row.branch_name} -> ${newBranch}`);
        updated++;
      }
    }
    console.log(`Finished updating ${updated} rows.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
