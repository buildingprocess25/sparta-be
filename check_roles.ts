import { pool } from "./src/db/pool";

async function checkUserRoles() {
  try {
    const rolesRows = await pool.query(`
      SELECT ur.role_name 
      FROM user_cabang_roles ucr 
      JOIN user_roles ur ON ucr.role_id = ur.id 
      WHERE ucr.user_cabang_id = 664
    `);
    
    console.log("ROLES:", rolesRows.rows.map(r => r.role_name));
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkUserRoles();
