import { withTransaction, pool } from "../db/pool";

type UserRow = {
    id: number;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
    email_sat: string;
    nama_pt: string | null;
};

const COMMIT = process.argv.includes("--commit");
const SUMMARY = process.argv.includes("--summary");

const AFFECTED_BRANCHES = [
    "CILEUNGSI",
    "BOGOR",
    "BEKASI",
    "KARAWANG",
    "CIKOKOL",
    "PARUNG",
    "BALARAJA",
    "SERANG",
];

const FINAL_INTERNAL_NAMES = [
    "TITUS TRI AJI",
    "LUKMAN SUPRAYITNO",
    "TEDY IRAWANTO",
    "MONIKA ALDI WIDYA",
    "SUKINO",
    "LOELIK KURNIA JANUARYSAH",
    "LOELIEK KURNIA JANUARYSAH",
    "ALVI RAFFASYA GHIFARI",
    "BUDIANTO",
    "ASTRA RAMDANI",
    "DANNY FEBRIANTO",
    "SUTRISNO",
    "PUPUT TRIYOGA SETIAWAN",
    "PUPUT TRIYOGA",
    "FIRMAN SOLEH",
    "CHAIRUL KOMARULLAH",
    "UJANG ROHMAN",
    "IMAM TRI UTOMO",
    "MUHAMMAD AJI PRANATA",
    "WAWAN SETIAWAN",
    "TRIO IRWANTO",
    "YOHANA DESY CHRISTIANI",
    "YOHANA DESY C",
];

const DELETE_INTERNAL_NAMES = [
    "CH. ADY SAPUTRA",
    "ARIS FINANDA",
    "EGA MAHENDRA",
    "SUGENG SANTOSA",
    "ANDRI WIJAYA",
    "ANDRI SOBARUDIN",
    "IQBAL MANDELI",
    "A. EKO APRIANTO",
    "BAYU ADI WIGUNA",
    "MAULANA AGUNG NUGROHO",
    "FAJAR CAHYONO",
    "SITI ROHAYANI",
    "DIAN BAYU SUKMANSYAH",
    "M. DANANG MUZAKI",
    "SYAHRUL ALFADILAH",
    "YOPIE ROBIANTO",
    "IRVAN ARIF PIANSYAH",
    "JOKO SUTRISNO",
    "CAESAR AGUNG BINTORO",
    "YUSUP AFANDI",
    "CECEP SUPRIYADI",
    "FURI SULAKSONO",
    "ILMADDINI RESTININGSIH",
    "IQHFARULLOH D. CAHYA",
    "KRESNA BAYU",
    "RIFAT SANTANA",
];

const INTERNAL_BRANCH_ROLES = [
    "BRANCH BUILDING & MAINTENANCE MANAGER",
    "BRANCH BUILDING COORDINATOR",
    "BRANCH BUILDING SUPPORT",
    "BRANCH MANAGER",
];

const normalize = (value?: string | null) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

function shouldDelete(user: UserRow): boolean {
    if (!AFFECTED_BRANCHES.includes(normalize(user.cabang))) return false;
    if (!INTERNAL_BRANCH_ROLES.includes(normalize(user.jabatan))) return false;
    if (FINAL_INTERNAL_NAMES.includes(normalize(user.nama_lengkap))) return false;
    return DELETE_INTERNAL_NAMES.includes(normalize(user.nama_lengkap));
}

async function findDeletionTargets(): Promise<UserRow[]> {
    const result = await pool.query<UserRow>(
        `
        SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
        FROM user_cabang
        WHERE UPPER(TRIM(cabang)) = ANY($1::text[])
          AND UPPER(TRIM(jabatan)) = ANY($2::text[])
        ORDER BY cabang, jabatan, nama_lengkap, id
        `,
        [AFFECTED_BRANCHES, INTERNAL_BRANCH_ROLES]
    );

    return result.rows.filter(shouldDelete);
}

async function main() {
    const targets = await findDeletionTargets();
    const targetIds = targets.map((user) => user.id);

    const output = {
        mode: COMMIT ? "commit" : "preview",
        delete_count: targets.length,
        targets,
    };

    if (SUMMARY && !COMMIT) {
        console.log(JSON.stringify({
            mode: output.mode,
            delete_count: output.delete_count,
            by_branch: targets.reduce<Record<string, number>>((acc, user) => {
                const branch = normalize(user.cabang);
                acc[branch] = (acc[branch] ?? 0) + 1;
                return acc;
            }, {}),
            targets,
        }, null, 2));
        return;
    }

    if (!COMMIT) {
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    await withTransaction(async (client) => {
        if (targetIds.length === 0) return;

        await client.query(
            `
            UPDATE auth_session s
            SET revoked_at = now(),
                updated_at = now()
            FROM user_cabang uc
            WHERE uc.id = ANY($1::int[])
              AND LOWER(TRIM(s.email_sat)) = LOWER(TRIM(uc.email_sat))
              AND LOWER(TRIM(s.cabang)) = LOWER(TRIM(uc.cabang))
              AND s.revoked_at IS NULL
            `,
            [targetIds]
        );

        await client.query(
            `
            DELETE FROM user_cabang
            WHERE id = ANY($1::int[])
            `,
            [targetIds]
        );
    });

    console.log(JSON.stringify(output, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
