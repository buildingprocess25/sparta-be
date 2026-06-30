process.env.GOOGLE_TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || "token.json";
process.env.GOOGLE_DOC_TOKEN_PATH = process.env.GOOGLE_DOC_TOKEN_PATH || "token_doc.json";

import { GoogleProvider } from "../common/google";
import { resolveDriveImageDataUrl } from "../common/drive-image";
import { pool } from "../db/pool";
import { serahTerimaRepository } from "../modules/serah-terima/serah-terima.repository";

const nomorUlok = process.argv[2] || "2VZ1-2603-R614-R";
const lingkup = process.argv[3] || "SIPIL";

const main = async () => {
    await GoogleProvider.initialize();

    const tokoResult = await pool.query<{ id_toko: number; opname_final_id: number; st_link: string | null }>(
        `
        SELECT
            t.id AS id_toko,
            ofn.id AS opname_final_id,
            bst.link_pdf AS st_link
        FROM toko t
        JOIN LATERAL (
            SELECT id
            FROM opname_final
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) ofn ON true
        LEFT JOIN LATERAL (
            SELECT link_pdf
            FROM berkas_serah_terima
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) bst ON true
        WHERE t.nomor_ulok = $1
          AND UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = UPPER(TRIM($2))
        LIMIT 1
        `,
        [nomorUlok, lingkup]
    );

    const target = tokoResult.rows[0];
    if (!target) throw new Error(`Target tidak ditemukan: ${nomorUlok} ${lingkup}`);

    const raw = await pool.query(
        `
        SELECT
            oi.id,
            COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan) AS kategori,
            COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan) AS jenis,
            NULLIF(TRIM(COALESCE(oi.foto, '')), '') IS NOT NULL AS has_opname_foto,
            NULLIF(TRIM(COALESCE(lp.dokumentasi_base64, '')), '') IS NOT NULL AS has_pengawasan_base64,
            NULLIF(TRIM(COALESCE(lp.dokumentasi, '')), '') IS NOT NULL AS has_pengawasan_link,
            LEFT(COALESCE(NULLIF(oi.foto, ''), lp.dokumentasi_base64, lp.dokumentasi, ''), 90) AS chosen_foto_prefix
        FROM opname_item oi
        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
        LEFT JOIN LATERAL (
            SELECT p.dokumentasi, p.dokumentasi_base64
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE p.id_gantt = (
                SELECT g.id
                FROM gantt_chart g
                WHERE g.id_toko = oi.id_toko
                ORDER BY g.id DESC
                LIMIT 1
            )
              AND UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, '')))
              AND UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, '')))
              AND (
                  NULLIF(TRIM(COALESCE(p.dokumentasi_base64, '')), '') IS NOT NULL
                  OR NULLIF(TRIM(COALESCE(p.dokumentasi, '')), '') IS NOT NULL
              )
            ORDER BY to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
            LIMIT 1
        ) lp ON true
        WHERE oi.id_opname_final = $1
        ORDER BY oi.id
        `,
        [target.opname_final_id]
    );

    const items = await serahTerimaRepository.findOpnameItemsByOpnameFinalId(target.opname_final_id);
    const sample = [];
    for (const item of items.slice(0, 12)) {
        const dataUrl = await resolveDriveImageDataUrl(item.foto);
        sample.push({
            id: item.id,
            jenis: item.jenis_pekerjaan,
            has_foto_value: Boolean(String(item.foto ?? "").trim()),
            foto_prefix: String(item.foto ?? "").slice(0, 50),
            resolved: Boolean(dataUrl),
            data_url_prefix: dataUrl?.slice(0, 30) ?? null,
        });
    }

    console.log(JSON.stringify({
        target,
        raw_summary: {
            total: raw.rows.length,
            has_opname_foto: raw.rows.filter((row: any) => row.has_opname_foto).length,
            has_pengawasan_base64: raw.rows.filter((row: any) => row.has_pengawasan_base64).length,
            has_pengawasan_link: raw.rows.filter((row: any) => row.has_pengawasan_link).length,
            chosen_foto: raw.rows.filter((row: any) => row.chosen_foto_prefix).length,
        },
        raw_rows: raw.rows,
        repository_summary: {
            total: items.length,
            foto_values: items.filter((item) => String(item.foto ?? "").trim()).length,
        },
        resolve_sample: sample,
    }, null, 2));
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
