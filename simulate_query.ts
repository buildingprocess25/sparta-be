import { pool } from "./src/db/pool";

async function runQueries() {
  try {
    const q1 = await pool.query(`
        SELECT id, nomor_ulok, status, cabang, pp_manager_approver_email 
        FROM projek_planning 
        WHERE status = 'WAITING_RAB_UPLOAD' 
        AND pp_manager_approver_email IS NOT NULL
    `);
    console.log("WAITING_RAB_UPLOAD with pp_manager_approver_email:", q1.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

runQueries();
