import { taskNotificationRepository } from "./src/modules/task-notification/task-notification.repository";
import { userCabangRepository } from "./src/modules/user-cabang/user-cabang.repository";
import { pool } from "./src/db/pool";

async function testNotif() {
  try {
    const rows = await pool.query(`SELECT * FROM user_cabang WHERE email_sat = 'eko.i.nugraha@sat.co.id'`);
    const u = rows.rows[0];
    
    // Check if the user has records in user_roles or similar if it exists?
    // Let's just mock the AuthenticatedUser
    const authUser = {
        id: u.id,
        email_sat: u.email_sat,
        cabang: u.cabang,
        jabatan: u.jabatan,
        roles: ["PROJECT PLANNING & DEVELOPMENT MANAGER"], // simulate standard
        nama_lengkap: u.nama_lengkap
    };
    
    // Call repository method directly (make sure it is exported or we can just copy it)
    const { getTaskNotifications } = require('./src/modules/task-notification/task-notification.service');
    // Service method is getTaskNotifications(user)
    const notifs = await getTaskNotifications(authUser as any);
    console.log("NOTIFICATIONS:", JSON.stringify(notifs, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

testNotif();
