process.env.GOOGLE_TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || "token.json";
process.env.GOOGLE_DOC_TOKEN_PATH = process.env.GOOGLE_DOC_TOKEN_PATH || "token_doc.json";

import { GoogleProvider } from "../common/google";
import { pool } from "../db/pool";
import { serahTerimaService } from "../modules/serah-terima/serah-terima.service";

const main = async () => {
    await GoogleProvider.initialize();

    const result = await pool.query<{ id_toko: number; nomor_ulok: string; nama_toko: string; lingkup_pekerjaan: string | null }>(`
        SELECT DISTINCT
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan
        FROM toko t
        JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        JOIN opname_final ofn ON ofn.id_toko = t.id
        WHERE t.cabang = 'LUWU'
          AND NULLIF(TRIM(COALESCE(bst.link_pdf, '')), '') IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM opname_item oi
              WHERE oi.id_opname_final = ofn.id
          )
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, t.id
    `);

    const rows = result.rows;
    console.table(rows);

    const generated = [];
    for (const row of rows) {
        const pdf = await serahTerimaService.createPdfSerahTerimaForMigration(row.id_toko);
        generated.push({
            nomor_ulok: row.nomor_ulok,
            lingkup_pekerjaan: row.lingkup_pekerjaan,
            id_toko: row.id_toko,
            st_id: pdf.id,
            link_pdf: pdf.link_pdf,
        });
        console.log(`[LUWU ST PHOTO] Regenerated ${row.nomor_ulok} ${row.lingkup_pekerjaan}: ${pdf.link_pdf}`);
    }

    console.log(JSON.stringify({ total: generated.length, generated }, null, 2));
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
