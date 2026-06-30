import { pool } from "../db/pool";

const main = async () => {
    const result = await pool.query(`
        SELECT
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            ofn.id AS opname_final_id,
            COUNT(oi.id)::int AS total_items,
            COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(oi.foto, '')), '') IS NOT NULL)::int AS foto_items,
            COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(oi.foto, '')), '') IS NULL)::int AS empty_foto_items
        FROM toko t
        JOIN opname_final ofn ON ofn.id_toko = t.id
        LEFT JOIN opname_item oi ON oi.id_opname_final = ofn.id
        WHERE t.cabang = 'LUWU'
          AND t.nomor_ulok IN (
              '2VZ1-2603-0002-R',
              '2VZ1-2603-0003',
              '2VZ1-2603-0004',
              '2VZ1-2603-0006',
              '2VZ1-2603-R353-R',
              '2VZ1-2603-R531-R',
              '2VZ1-2603-R614-R',
              '2VZ1-2603-R702-R'
          )
        GROUP BY t.nomor_ulok, t.nama_toko, t.lingkup_pekerjaan, ofn.id
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, ofn.id
    `);
    console.table(result.rows);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
