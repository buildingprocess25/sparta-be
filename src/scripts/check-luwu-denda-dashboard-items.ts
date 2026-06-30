import { pool } from "../db/pool";

const main = async () => {
    const result = await pool.query(`
        SELECT
            t.id,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            t.cabang,
            ofn.id AS opname_final_id,
            ofn.tipe_opname,
            ofn.aksi,
            ofn.status_opname_final,
            to_char(ofn.created_at, 'YYYY-MM-DD') AS opname_created_at,
            ofn.hari_denda,
            ofn.nilai_denda,
            to_char(ofn.tanggal_serah_terima_denda, 'YYYY-MM-DD') AS tanggal_st_denda,
            bst.id AS st_id,
            to_char(bst.created_at, 'YYYY-MM-DD') AS st_created_at,
            bst.link_pdf AS st_link,
            COALESCE(oi.item_count, 0)::int AS item_count
        FROM toko t
        LEFT JOIN LATERAL (
            SELECT *
            FROM opname_final
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) ofn ON true
        LEFT JOIN LATERAL (
            SELECT *
            FROM berkas_serah_terima
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) bst ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS item_count
            FROM opname_item oi
            WHERE oi.id_opname_final = ofn.id
        ) oi ON true
        WHERE t.cabang = 'LUWU'
          AND t.nomor_ulok IN (
              '2VZ1-2603-0002-R',
              '2VZ1-2603-0003',
              '2VZ1-2603-0004',
              '2VZ1-2603-0005',
              '2VZ1-2603-0006',
              '2VZ1-2604-0001-R',
              '2VZ1-2605-R378-R',
              '2VZ1-2605-R413-R'
          )
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
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
