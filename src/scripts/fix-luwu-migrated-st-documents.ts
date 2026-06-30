import { pool, withTransaction } from "../db/pool";
import { GoogleProvider } from "../common/google";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";
import { serahTerimaService } from "../modules/serah-terima/serah-terima.service";

type CandidateRow = {
    id_toko: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    lingkup_pekerjaan: string | null;
    opname_final_id: number;
    tanggal_st: string;
    item_count: number;
    existing_st_id: number | null;
};

const main = async () => {
    await GoogleProvider.initialize();

    const result = await pool.query<CandidateRow>(`
        WITH latest_opname AS (
            SELECT DISTINCT ON (id_toko)
                id,
                id_toko,
                created_at
            FROM opname_final
            ORDER BY id_toko, id DESC
        ),
        latest_st AS (
            SELECT DISTINCT ON (id_toko)
                id,
                id_toko,
                link_pdf
            FROM berkas_serah_terima
            ORDER BY id_toko, id DESC
        )
        SELECT
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            ofn.id AS opname_final_id,
            to_char(ofn.created_at, 'YYYY-MM-DD') AS tanggal_st,
            oi.item_count,
            st.id AS existing_st_id
        FROM toko t
        JOIN latest_opname ofn ON ofn.id_toko = t.id
        JOIN LATERAL (
            SELECT COUNT(*)::int AS item_count
            FROM opname_item oi
            WHERE oi.id_opname_final = ofn.id
        ) oi ON oi.item_count > 0
        LEFT JOIN latest_st st ON st.id_toko = t.id
        WHERE t.cabang = 'LUWU'
          AND NULLIF(TRIM(COALESCE(st.link_pdf, '')), '') IS NULL
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, t.id
    `);

    const candidates = result.rows;
    console.table(candidates.map((row) => ({
        nomor_ulok: row.nomor_ulok,
        lingkup: row.lingkup_pekerjaan,
        nama_toko: row.nama_toko,
        opname_final_id: row.opname_final_id,
        tanggal_st: row.tanggal_st,
        item_count: row.item_count,
        existing_st_id: row.existing_st_id,
    })));

    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_migration_backfill_audit (
                audit_id SERIAL PRIMARY KEY,
                nomor_ulok TEXT NOT NULL,
                lingkup_pekerjaan TEXT NOT NULL,
                id_toko INT NOT NULL,
                opname_final_id INT NOT NULL,
                old_berkas_serah_terima_id INT,
                tanggal_st DATE NOT NULL,
                link_pdf TEXT,
                catatan TEXT,
                backfilled_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        for (const row of candidates) {
            const stResult = row.existing_st_id
                ? await client.query(
                    `
                    UPDATE berkas_serah_terima
                    SET created_at = $1::date
                    WHERE id = $2
                    RETURNING id
                    `,
                    [row.tanggal_st, row.existing_st_id]
                )
                : await client.query(
                    `
                    INSERT INTO berkas_serah_terima (id_toko, link_pdf, created_at)
                    VALUES ($1, NULL, $2::date)
                    RETURNING id
                    `,
                    [row.id_toko, row.tanggal_st]
                );

            await client.query(
                `
                INSERT INTO serah_terima_migration_backfill_audit (
                    nomor_ulok, lingkup_pekerjaan, id_toko, opname_final_id,
                    old_berkas_serah_terima_id, tanggal_st, link_pdf, catatan
                )
                VALUES ($1, $2, $3, $4, $5, $6::date, NULL, $7)
                `,
                [
                    row.nomor_ulok ?? "",
                    row.lingkup_pekerjaan ?? "",
                    row.id_toko,
                    row.opname_final_id,
                    stResult.rows[0].id,
                    row.tanggal_st,
                    "Fix dokumen ST migrasi LUWU dari tanggal opname final",
                ]
            );
        }
    });

    const generated = [];
    for (const row of candidates) {
        const pdf = await serahTerimaService.createPdfSerahTerimaForMigration(row.id_toko);
        await opnameFinalService.refreshDendaByTokoId(row.id_toko);
        generated.push({
            nomor_ulok: row.nomor_ulok,
            lingkup: row.lingkup_pekerjaan,
            st_id: pdf.id,
            tanggal_st: pdf.created_at,
            link_pdf: pdf.link_pdf,
        });
        console.log(`[LUWU ST MIGRATION] PDF ST selesai ${row.nomor_ulok} ${row.lingkup_pekerjaan}: ${pdf.link_pdf}`);
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
