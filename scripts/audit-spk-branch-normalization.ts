import { pool } from "../src/db/pool";
import { getBranchScopeCandidates, normalizeBranchScopeName } from "../src/common/branch-scope";

const branch = process.argv[2] ?? "SIDOARJO";
const candidates = getBranchScopeCandidates(branch);
const normalizedCandidates = candidates.map(normalizeBranchScopeName);

async function main() {
    const raw = await pool.query<{ cabang: string; count: number }>(
        `
        SELECT COALESCE(t.cabang, '-') AS cabang, COUNT(*)::int AS count
        FROM pengajuan_spk p
        LEFT JOIN toko t ON t.id = p.id_toko
        WHERE UPPER(TRIM(t.cabang)) = ANY($1::text[])
        GROUP BY COALESCE(t.cabang, '-')
        ORDER BY cabang
        `,
        [normalizedCandidates]
    );

    const normalized = await pool.query<{ cabang: string; count: number }>(
        `
        SELECT COALESCE(t.cabang, '-') AS cabang, COUNT(*)::int AS count
        FROM pengajuan_spk p
        LEFT JOIN toko t ON t.id = p.id_toko
        WHERE REPLACE(UPPER(TRIM(t.cabang)), '_', ' ') = ANY($1::text[])
        GROUP BY COALESCE(t.cabang, '-')
        ORDER BY cabang
        `,
        [normalizedCandidates]
    );

    console.log(`branch=${branch}`);
    console.log(`scope=${normalizedCandidates.join(",")}`);
    console.log(`raw_match=${JSON.stringify(raw.rows)}`);
    console.log(`normalized_match=${JSON.stringify(normalized.rows)}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
