import { pool } from "../db/pool";

async function main() {
    const result = await pool.query(
        `
        SELECT
            uc.id,
            uc.cabang,
            uc.nama_lengkap,
            uc.jabatan,
            uc.email_sat,
            COALESCE(
                ARRAY_AGG(ubc.covered_cabang ORDER BY ubc.covered_cabang)
                    FILTER (WHERE ubc.covered_cabang IS NOT NULL),
                ARRAY[]::text[]
            ) AS coverage
        FROM user_cabang uc
        LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
        WHERE UPPER(TRIM(uc.cabang)) = 'CIKOKOL'
          AND UPPER(COALESCE(uc.jabatan, '')) LIKE '%MAINTENANCE MANAGER%'
        GROUP BY uc.id, uc.cabang, uc.nama_lengkap, uc.jabatan, uc.email_sat
        ORDER BY uc.nama_lengkap
        `
    );

    console.log(JSON.stringify(result.rows, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
