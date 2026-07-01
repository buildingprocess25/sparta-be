import { pool } from "../db/pool";

type UserRow = {
    id: number;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
    email_sat: string;
    nama_pt: string | null;
};

type PlannedAction = {
    type: string;
    id?: number;
    email_sat?: string;
    nama_lengkap?: string | null;
    jabatan?: string | null;
    from_cabang?: string;
    to_cabang?: string;
    coverage?: string[];
    note?: string;
};

const COMMIT = process.argv.includes("--commit");
const SUMMARY = process.argv.includes("--summary");

const PARENT_GROUPS: Record<"CILEUNGSI" | "CIKOKOL", string[]> = {
    CILEUNGSI: ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"],
    CIKOKOL: ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG"],
};

const BRANCH_TO_PARENT = Object.entries(PARENT_GROUPS).reduce<Record<string, string>>((acc, [parent, branches]) => {
    for (const branch of branches) acc[branch] = parent;
    return acc;
}, {});

const FINAL_INTERNAL = [
    {
        parent: "CILEUNGSI",
        names: ["TITUS TRI AJI"],
        jabatan: "BRANCH BUILDING & MAINTENANCE MANAGER",
        coverage: ["CILEUNGSI", "BOGOR"],
        label: "CILEUNGSI BOGOR",
    },
    {
        parent: "CILEUNGSI",
        names: ["LUKMAN SUPRAYITNO"],
        jabatan: "BRANCH BUILDING COORDINATOR",
        coverage: ["CILEUNGSI", "BOGOR"],
        label: "CILEUNGSI BOGOR",
    },
    {
        parent: "CILEUNGSI",
        names: ["TEDY IRAWANTO", "MONIKA ALDI WIDYA", "SUKINO"],
        jabatan: "BRANCH BUILDING SUPPORT",
        coverage: ["CILEUNGSI", "BOGOR"],
        label: "CILEUNGSI BOGOR",
    },
    {
        parent: "CILEUNGSI",
        names: ["LOELIK KURNIA JANUARYSAH", "LOELIEK KURNIA JANUARYSAH"],
        jabatan: "BRANCH BUILDING & MAINTENANCE MANAGER",
        coverage: ["BEKASI", "KARAWANG"],
        label: "BEKASI KARAWANG",
    },
    {
        parent: "CILEUNGSI",
        names: ["ALVI RAFFASYA GHIFARI"],
        jabatan: "BRANCH BUILDING COORDINATOR",
        coverage: ["BEKASI", "KARAWANG"],
        label: "BEKASI KARAWANG",
    },
    {
        parent: "CILEUNGSI",
        names: ["BUDIANTO", "ASTRA RAMDANI"],
        jabatan: "BRANCH BUILDING SUPPORT",
        coverage: ["BEKASI", "KARAWANG"],
        label: "BEKASI KARAWANG",
    },
    {
        parent: "CILEUNGSI",
        names: ["DANNY FEBRIANTO"],
        jabatan: "BRANCH MANAGER",
        coverage: PARENT_GROUPS.CILEUNGSI,
        label: "ALL CILEUNGSI BRANCH",
    },
    {
        parent: "CIKOKOL",
        names: ["SUTRISNO"],
        jabatan: "BRANCH BUILDING & MAINTENANCE MANAGER",
        coverage: ["CIKOKOL", "PARUNG"],
        label: "CIKOKOL PARUNG",
    },
    {
        parent: "CIKOKOL",
        names: ["PUPUT TRIYOGA SETIAWAN", "PUPUT TRIYOGA"],
        jabatan: "BRANCH BUILDING COORDINATOR",
        coverage: ["CIKOKOL", "PARUNG"],
        label: "CIKOKOL PARUNG",
    },
    {
        parent: "CIKOKOL",
        names: ["FIRMAN SOLEH"],
        jabatan: "BRANCH BUILDING & MAINTENANCE MANAGER",
        coverage: ["BALARAJA", "SERANG"],
        label: "BALARAJA SERANG",
    },
    {
        parent: "CIKOKOL",
        names: ["CHAIRUL KOMARULLAH"],
        jabatan: "BRANCH BUILDING COORDINATOR",
        coverage: ["BALARAJA", "SERANG"],
        label: "BALARAJA SERANG",
    },
    {
        parent: "CIKOKOL",
        names: ["UJANG ROHMAN", "IMAM TRI UTOMO", "MUHAMMAD AJI PRANATA", "WAWAN SETIAWAN", "TRIO IRWANTO"],
        jabatan: "BRANCH BUILDING SUPPORT",
        coverage: PARENT_GROUPS.CIKOKOL,
        label: "ALL CIKOKOL BRANCH",
    },
    {
        parent: "CIKOKOL",
        names: ["YOHANA DESY CHRISTIANI", "YOHANA DESY C"],
        jabatan: "BRANCH MANAGER",
        coverage: PARENT_GROUPS.CIKOKOL,
        label: "ALL CIKOKOL BRANCH",
    },
] as const;

const BRANCH_MANAGER_MUTATIONS = [
    { name: "SURIADI", from: "SERANG", to: "BATAM" },
    { name: "LILIK SOEHADA", aliases: ["LILIK SUHADA"], from: "BEKASI", to: "JEMBER" },
    { name: "BAMBANG EKO BUDIYANTO", from: "BOGOR", to: "GORONTALO" },
] as const;

const normalize = (value?: string | null) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const mutationAliases = (mutation: (typeof BRANCH_MANAGER_MUTATIONS)[number]): readonly string[] =>
    "aliases" in mutation ? mutation.aliases : [];
const sameMergeIdentity = (left: UserRow, right: UserRow): boolean =>
    normalize(left.jabatan) === normalize(right.jabatan)
    && normalize(left.nama_pt) === normalize(right.nama_pt);
const isContractorRole = (jabatan?: string | null) => normalize(jabatan).includes("KONTRAKTOR") || normalize(jabatan).includes("DIREKTUR");
const isInternalBranchRole = (jabatan?: string | null) =>
    [
        "BRANCH BUILDING & MAINTENANCE MANAGER",
        "BRANCH BUILDING COORDINATOR",
        "BRANCH BUILDING SUPPORT",
        "BRANCH MANAGER",
    ].includes(normalize(jabatan));

async function ensureCoverageTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_branch_coverage (
            id SERIAL PRIMARY KEY,
            user_cabang_id INTEGER NOT NULL REFERENCES user_cabang(id) ON DELETE CASCADE,
            covered_cabang VARCHAR(255) NOT NULL,
            coverage_label VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_branch_coverage_user_cabang
                UNIQUE (user_cabang_id, covered_cabang)
        );
    `);
}

async function findUsersByName(names: readonly string[]): Promise<UserRow[]> {
    const normalizedNames = names.map(normalize);
    const result = await pool.query<UserRow>(
        `
        SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
        FROM user_cabang
        WHERE UPPER(TRIM(REGEXP_REPLACE(COALESCE(nama_lengkap, ''), '\\s+', ' ', 'g'))) = ANY($1::text[])
        ORDER BY id
        `,
        [normalizedNames]
    );
    return result.rows;
}

async function findParentConflict(user: UserRow, targetCabang: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
        `
        SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
        FROM user_cabang
        WHERE LOWER(TRIM(email_sat)) = LOWER(TRIM($1))
          AND LOWER(TRIM(cabang)) = LOWER(TRIM($2))
          AND id <> $3
        ORDER BY id
        LIMIT 1
        `,
        [user.email_sat, targetCabang, user.id]
    );
    return result.rows[0] ?? null;
}

async function upsertCoverage(userCabangId: number, branches: readonly string[], label: string | null) {
    for (const branch of branches) {
        await pool.query(
            `
            INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang, coverage_label)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_cabang_id, covered_cabang)
            DO UPDATE SET coverage_label = EXCLUDED.coverage_label
            `,
            [userCabangId, branch, label]
        );
    }
}

async function moveOrMergeUser(user: UserRow, targetCabang: string, actions: PlannedAction[]): Promise<number | null> {
    const currentCabang = normalize(user.cabang);
    if (currentCabang === targetCabang) return user.id;

    const conflict = await findParentConflict(user, targetCabang);
    if (conflict) {
        if (!sameMergeIdentity(user, conflict)) {
            actions.push({
                type: "MANUAL_REVIEW_LOGIN_CONFLICT",
                id: user.id,
                email_sat: user.email_sat,
                nama_lengkap: user.nama_lengkap,
                jabatan: user.jabatan,
                from_cabang: user.cabang,
                to_cabang: targetCabang,
                note: `Target parent already has user_cabang id ${conflict.id} with different role/company (${conflict.jabatan || "-"} / ${conflict.nama_pt || "-"}).`,
            });
            return null;
        }

        actions.push({
            type: COMMIT ? "MERGED_USER" : "WOULD_MERGE_USER",
            id: user.id,
            email_sat: user.email_sat,
            nama_lengkap: user.nama_lengkap,
            jabatan: user.jabatan,
            from_cabang: user.cabang,
            to_cabang: targetCabang,
            note: `Merged into existing user_cabang id ${conflict.id}`,
        });
        if (COMMIT) {
            await pool.query(
                `
                INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang, coverage_label)
                SELECT $1, covered_cabang, coverage_label
                FROM user_branch_coverage
                WHERE user_cabang_id = $2
                ON CONFLICT (user_cabang_id, covered_cabang) DO NOTHING
                `,
                [conflict.id, user.id]
            );
            await pool.query("DELETE FROM user_branch_coverage WHERE user_cabang_id = $1", [user.id]);
            await pool.query("DELETE FROM user_cabang WHERE id = $1", [user.id]);
        }
        return conflict.id;
    }

    actions.push({
        type: COMMIT ? "UPDATED_USER_BRANCH" : "WOULD_UPDATE_USER_BRANCH",
        id: user.id,
        email_sat: user.email_sat,
        nama_lengkap: user.nama_lengkap,
        jabatan: user.jabatan,
        from_cabang: user.cabang,
        to_cabang: targetCabang,
    });
    if (COMMIT) {
        await pool.query("UPDATE user_cabang SET cabang = $1 WHERE id = $2", [targetCabang, user.id]);
    }
    return user.id;
}

async function main() {
    if (COMMIT) await ensureCoverageTable();
    const actions: PlannedAction[] = [];

    for (const item of FINAL_INTERNAL) {
        const allowedBranches = new Set([...item.coverage, item.parent].map(normalize));
        const users = (await findUsersByName(item.names)).filter(user => allowedBranches.has(normalize(user.cabang)));
        if (users.length === 0) {
            actions.push({
                type: "MISSING_FINAL_INTERNAL_USER",
                nama_lengkap: item.names[0],
                jabatan: item.jabatan,
                to_cabang: item.parent,
                coverage: [...item.coverage],
            });
            continue;
        }

        for (const user of users) {
            const finalUserId = await moveOrMergeUser(user, item.parent, actions);
            if (!finalUserId) continue;
            actions.push({
                type: COMMIT ? "UPSERTED_COVERAGE" : "WOULD_UPSERT_COVERAGE",
                id: finalUserId,
                email_sat: user.email_sat,
                nama_lengkap: user.nama_lengkap,
                jabatan: item.jabatan,
                to_cabang: item.parent,
                coverage: [...item.coverage],
                note: item.label,
            });
            if (COMMIT) {
                await pool.query("UPDATE user_cabang SET jabatan = $1 WHERE id = $2", [item.jabatan, finalUserId]);
                await upsertCoverage(finalUserId, item.coverage, item.label);
            }
        }
    }

    for (const mutation of BRANCH_MANAGER_MUTATIONS) {
        const users = await findUsersByName([mutation.name, ...mutationAliases(mutation)]);
        for (const user of users.filter(row => normalize(row.cabang) === mutation.from && normalize(row.jabatan) === "BRANCH MANAGER")) {
            await moveOrMergeUser(user, mutation.to, actions);
        }
    }

    const affectedBranches = Object.keys(BRANCH_TO_PARENT);
    const contractorResult = await pool.query<UserRow>(
        `
        SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
        FROM user_cabang
        WHERE UPPER(TRIM(cabang)) = ANY($1::text[])
          AND (
              UPPER(COALESCE(jabatan, '')) LIKE '%KONTRAKTOR%'
              OR UPPER(COALESCE(jabatan, '')) LIKE '%DIREKTUR%'
          )
        ORDER BY cabang, email_sat, id
        `,
        [affectedBranches]
    );

    for (const user of contractorResult.rows) {
        const oldBranch = normalize(user.cabang);
        const parent = BRANCH_TO_PARENT[oldBranch];
        if (!parent) continue;
        const finalUserId = await moveOrMergeUser(user, parent, actions);
        if (!finalUserId) continue;
        actions.push({
            type: COMMIT ? "UPSERTED_CONTRACTOR_COVERAGE" : "WOULD_UPSERT_CONTRACTOR_COVERAGE",
            id: finalUserId,
            email_sat: user.email_sat,
            nama_lengkap: user.nama_lengkap,
            jabatan: user.jabatan,
            to_cabang: parent,
            coverage: [oldBranch],
        });
        if (COMMIT) await upsertCoverage(finalUserId, [oldBranch], `MIGRATED ${parent}`);
    }

    const reviewResult = await pool.query<UserRow>(
        `
        SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
        FROM user_cabang
        WHERE UPPER(TRIM(cabang)) = ANY($1::text[])
        ORDER BY cabang, jabatan, nama_lengkap
        `,
        [affectedBranches]
    );
    const finalNames = new Set(FINAL_INTERNAL.flatMap(item => item.names.map(normalize)));
    const mutationNames = new Set(BRANCH_MANAGER_MUTATIONS.flatMap(item => [item.name, ...mutationAliases(item)].map(normalize)));
    for (const user of reviewResult.rows) {
        if (!isInternalBranchRole(user.jabatan)) continue;
        if (finalNames.has(normalize(user.nama_lengkap)) || mutationNames.has(normalize(user.nama_lengkap))) continue;
        if (isContractorRole(user.jabatan)) continue;
        actions.push({
            type: "MANUAL_REVIEW_INTERNAL_USER",
            id: user.id,
            email_sat: user.email_sat,
            nama_lengkap: user.nama_lengkap,
            jabatan: user.jabatan,
            from_cabang: user.cabang,
            note: "Internal branch-role user remains in affected branch but is not in the approved final SPARTA structure.",
        });
    }

    const output = {
        mode: COMMIT ? "commit" : "preview",
        action_count: actions.length,
        actions,
    };

    if (SUMMARY) {
        const byType = actions.reduce<Record<string, number>>((acc, action) => {
            acc[action.type] = (acc[action.type] ?? 0) + 1;
            return acc;
        }, {});
        console.log(JSON.stringify({
            mode: output.mode,
            action_count: output.action_count,
            by_type: byType,
            missing_final_internal_users: actions.filter(action => action.type === "MISSING_FINAL_INTERNAL_USER"),
            manual_review_internal_users: actions.filter(action => action.type === "MANUAL_REVIEW_INTERNAL_USER"),
        }, null, 2));
        return;
    }

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
