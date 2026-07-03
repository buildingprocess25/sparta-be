import { pool } from "../src/db/pool";
import { taskNotificationRepository } from "../src/modules/task-notification/task-notification.repository";
import type { AuthenticatedUser } from "../src/modules/auth/auth-session.service";

type UserRow = {
    id: number;
    email_sat: string;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
    nama_pt: string | null;
};

const email = process.argv[2];

if (!email) {
    console.error("Usage: npx tsx scripts/audit-task-notifications-user.ts <email>");
    process.exit(1);
}

async function main() {
    const result = await pool.query<UserRow>(
        `
        SELECT id, email_sat, cabang, nama_lengkap, jabatan, nama_pt
        FROM user_cabang
        WHERE LOWER(TRIM(email_sat)) = LOWER(TRIM($1))
        ORDER BY id
        `,
        [email]
    );

    if (result.rowCount === 0) {
        console.log(`User not found: ${email}`);
        return;
    }

    for (const row of result.rows) {
        const user: AuthenticatedUser = {
            session_id: 0,
            email_sat: row.email_sat,
            cabang: row.cabang,
            nama_lengkap: row.nama_lengkap,
            jabatan: row.jabatan,
            roles: row.jabatan ? [row.jabatan.trim().toUpperCase()] : [],
            nama_pt: row.nama_pt,
            expires_at: "",
        };

        const groups = await taskNotificationRepository.getGroups(user);
        console.log(`\nUSER ${row.email_sat}`);
        console.log(`  name=${row.nama_lengkap ?? ""}`);
        console.log(`  cabang=${row.cabang}`);
        console.log(`  jabatan=${row.jabatan ?? ""}`);
        console.log(`  nama_pt=${row.nama_pt ?? ""}`);
        for (const group of groups) {
            console.log(`  group=${group.title}; count=${group.count}; key=${group.key}`);
            for (const item of group.items.slice(0, 5)) {
                console.log(`    - ${item.title} | ${item.subtitle} | ${item.entity_type}`);
            }
        }
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
