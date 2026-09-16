import { pool } from "./src/db/pool";

async function checkPendingApprovals() {
  try {
    const res = await pool.query(`
      SELECT 
        id, 
        nomor_ulok, 
        cabang, 
        nama_toko, 
        status, 
        created_at, 
        updated_at
      FROM projek_planning 
      WHERE status NOT IN ('FINAL', 'REJECTED_BY_BM', 'REJECTED_BY_PP1')
      ORDER BY created_at DESC;
    `);
    
    console.log("=== PENDING PROJECT PLANNING ===");
    if (res.rows.length === 0) {
      console.log("No pending approvals found in database.");
    } else {
      console.table(res.rows);
    }
    
    const statusCounts = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM projek_planning
      GROUP BY status;
    `);
    console.log("\n=== STATUS COUNTS ===");
    console.table(statusCounts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkPendingApprovals();
