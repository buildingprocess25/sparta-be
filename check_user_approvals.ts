import { pool } from "./src/db/pool";

async function checkUserApprovals() {
  try {
    const user = await pool.query(`
      SELECT * FROM user_cabang 
      WHERE email_sat = 'eko.i.nugraha@sat.co.id'
    `);
    console.log("USER:", user.rows[0]);
    
    // Check if there is any approval for WAITING_PP_MANAGER_APPROVAL
    const pp = await pool.query(`
      SELECT id, status, cabang, nomor_ulok FROM projek_planning 
      WHERE status = 'WAITING_PP_MANAGER_APPROVAL'
    `);
    console.log("PP Manager Approvals:", pp.rows);
    
    // Check WAITING_PP_APPROVAL_1
    const pp1 = await pool.query(`
      SELECT id, status, cabang, nomor_ulok FROM projek_planning 
      WHERE status = 'WAITING_PP_APPROVAL_1'
    `);
    console.log("PP 1 Approvals:", pp1.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkUserApprovals();
