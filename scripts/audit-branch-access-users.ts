import { getEffectiveBranchesForUser } from "../src/common/branch-scope";
import { pool } from "../src/db/pool";

type UserRow = {
    id: number;
    email_sat: string;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
};

const args = process.argv.slice(2);
const includeSupportSamples = args.includes("--support-samples");
const targetNames = args.filter((arg) => arg !== "--support-samples");
const names = targetNames.length > 0 ? targetNames : ["FIRMAN SOLEH", "SUTRISNO"];

const pendingRabStatuses = [
    "Menunggu Persetujuan Koordinator",
    "Menunggu Persetujuan Manager",
    "Menunggu Persetujuan Direktur",
    "WAITING_FOR_BM_APPROVAL",
];

async function auditUser(name: string) {
    const users = await pool.query<UserRow>(
        `
        SELECT id, email_sat, cabang, nama_lengkap, jabatan
        FROM user_cabang
        WHERE UPPER(TRIM(nama_lengkap)) = UPPER(TRIM($1))
        ORDER BY id
        `,
        [name]
    );

    console.log(`\nUSER ${name}`);
    if (users.rowCount === 0) {
        console.log("  not_found");
        return;
    }

    for (const user of users.rows) {
        const scope = await getEffectiveBranchesForUser({
            emailSat: user.email_sat,
            cabang: user.cabang,
            roles: user.jabatan ? [user.jabatan] : [],
        });

        const pendingRab = await pool.query<{ cabang: string; count: number }>(
            `
            SELECT UPPER(TRIM(t.cabang)) AS cabang, COUNT(*)::int AS count
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            WHERE UPPER(TRIM(t.cabang)) = ANY($1::text[])
              AND r.status = ANY($2::text[])
            GROUP BY UPPER(TRIM(t.cabang))
            ORDER BY cabang
            `,
            [scope.branches, pendingRabStatuses]
        );

        console.log(`  email=${user.email_sat}`);
        console.log(`  cabang=${user.cabang}`);
        console.log(`  jabatan=${user.jabatan ?? ""}`);
        console.log(`  source=${scope.source}`);
        console.log(`  branches=${scope.branches.join(",")}`);
        console.log(`  pending_rab_by_branch=${JSON.stringify(pendingRab.rows)}`);
    }
}

async function main() {
    for (const name of names) {
        await auditUser(name);
    }

    if (includeSupportSamples) {
        const samples = await pool.query<UserRow>(
            `
            SELECT DISTINCT ON (UPPER(TRIM(cabang)))
                id, email_sat, cabang, nama_lengkap, jabatan
            FROM user_cabang
            WHERE UPPER(COALESCE(jabatan, '')) LIKE '%BRANCH BUILDING SUPPORT%'
              AND UPPER(TRIM(cabang)) IN ('CIKOKOL', 'CILEUNGSI')
            ORDER BY UPPER(TRIM(cabang)), id
            `
        );

        for (const user of samples.rows) {
            const scope = await getEffectiveBranchesForUser({
                emailSat: user.email_sat,
                cabang: user.cabang,
                roles: user.jabatan ? [user.jabatan] : [],
            });

            console.log(`\nSUPPORT_SAMPLE ${user.cabang}`);
            console.log(`  name=${user.nama_lengkap ?? ""}`);
            console.log(`  email=${user.email_sat}`);
            console.log(`  jabatan=${user.jabatan ?? ""}`);
            console.log(`  source=${scope.source}`);
            console.log(`  branches=${scope.branches.join(",")}`);
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
