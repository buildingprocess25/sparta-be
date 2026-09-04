const { Client } = require('pg');

async function main() {
    const bUrl = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';
    const mUrl = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/maintenance?sslmode=disable';
    const eUrl = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/energy?sslmode=disable';
    const sUrl = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable';

    const bClient = new Client(bUrl);
    const mClient = new Client(mUrl);
    const eClient = new Client(eUrl);
    const sClient = new Client(sUrl);

    await bClient.connect();
    await mClient.connect();
    await eClient.connect();
    await sClient.connect();

    try {
        console.log("Menarik data pengguna dari Building, Maintenance, dan Energy...");

        const { rows: bUsers } = await bClient.query("SELECT email_sat as email, nama_lengkap as name, jabatan as role, cabang as branch FROM user_cabang WHERE email_sat IS NOT NULL AND email_sat != ''");
        const { rows: mUsers } = await mClient.query("SELECT email, role, 'PUSAT' as branch, \"NIK\" as name FROM \"User\" WHERE email IS NOT NULL AND email != ''");
        const { rows: eUsers } = await eClient.query("SELECT email, full_name as name, role, branch, password_hash FROM users WHERE email IS NOT NULL AND email != ''");

        console.log(`Ditemukan: ${bUsers.length} Building, ${mUsers.length} Maintenance, ${eUsers.length} Energy`);

        const masterUsers = {};

        for (const u of bUsers) {
            const e = u.email.toLowerCase().trim();
            if (!masterUsers[e]) masterUsers[e] = { email: e, name: u.name || e, branch: u.branch || 'PUSAT', roles: [] };
            masterUsers[e].roles.push({ module: 'BUILDING', role: u.role || 'USER' });
            masterUsers[e].branch = u.branch || masterUsers[e].branch;
        }

        for (const u of mUsers) {
            const e = u.email.toLowerCase().trim();
            if (!masterUsers[e]) masterUsers[e] = { email: e, name: u.name || e, branch: 'PUSAT', roles: [] };
            masterUsers[e].roles.push({ module: 'MAINTENANCE', role: u.role || 'USER' });
        }

        for (const u of eUsers) {
            const e = u.email.toLowerCase().trim();
            if (!masterUsers[e]) masterUsers[e] = { email: e, name: u.name || e, branch: u.branch || 'PUSAT', roles: [] };
            masterUsers[e].roles.push({ module: 'ENERGY', role: u.role || 'USER' });
            masterUsers[e].passwordHash = u.password_hash;
            masterUsers[e].branch = u.branch || masterUsers[e].branch;
        }

        console.log(`Total pengguna unik: ${Object.keys(masterUsers).length}`);
        console.log("Memulai injeksi ke SPARTA SSO...");

        await sClient.query("BEGIN");

        let branches = {};
        for (const email in masterUsers) {
            const user = masterUsers[email];
            let branchCode = user.branch.toUpperCase().trim();
            if (!branches[branchCode]) {
                const bRes = await sClient.query(
                    `INSERT INTO "Branch" (id, code, name, "createdAt", "updatedAt") 
                     VALUES (gen_random_uuid(), $1, $1, NOW(), NOW()) 
                     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
                    [branchCode]
                );
                branches[branchCode] = bRes.rows[0].id;
            }

            const branchId = branches[branchCode];
            const passwordState = user.passwordHash ? 'USER_SET' : 'BRANCH_DEFAULT';
            
            const uRes = await sClient.query(
                `INSERT INTO "User" (id, email, "fullName", "branchId", "passwordHash", "passwordState", role, status, "failedLoginCount", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'USER', 'ACTIVE', 0, NOW(), NOW())
                 ON CONFLICT (email) DO UPDATE SET 
                     "fullName" = EXCLUDED."fullName",
                     "passwordHash" = COALESCE(EXCLUDED."passwordHash", "User"."passwordHash"),
                     "passwordState" = EXCLUDED."passwordState"
                 RETURNING id`,
                [user.email, user.name || user.email, branchId, user.passwordHash || null, passwordState]
            );
            
            const userId = uRes.rows[0].id;

            // Injeksi Akses Modul
            for (const r of user.roles) {
                await sClient.query(
                    `INSERT INTO "UserModuleAccess" (id, "userId", "moduleId", role, "isActive", "grantedAt")
                     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW())
                     ON CONFLICT ("userId", "moduleId") DO UPDATE SET role = EXCLUDED.role, "isActive" = true`,
                    [userId, r.module, r.role]
                );
            }
        }

        await sClient.query("COMMIT");
        console.log("✅ Migrasi sukses!");

    } catch (e) {
        await sClient.query("ROLLBACK");
        console.error("❌ Error migrasi:", e);
    } finally {
        await bClient.end();
        await mClient.end();
        await eClient.end();
        await sClient.end();
    }
}

main();
