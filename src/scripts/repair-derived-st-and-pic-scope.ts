import { pool, withTransaction } from "../db/pool";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";

const args = process.argv.slice(2);
const shouldCommit = args.includes("--commit");

type PicCandidate = {
    id_toko: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    cabang: string | null;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string | null;
    durasi: string | null;
    tanggal_mulai_spk: string | null;
    source_pic_id: number;
    plc_building_support: string | null;
};

type StCandidate = {
    id_toko: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    cabang: string | null;
    opname_final_id: number;
    opname_created_at: string;
    link_pdf_opname: string | null;
};

const printTable = (title: string, rows: unknown[]) => {
    console.log(`\n## ${title}`);
    if (rows.length === 0) {
        console.log("(none)");
        return;
    }
    console.table(rows);
};

const findPicCandidates = async (): Promise<PicCandidate[]> => {
    const result = await pool.query<PicCandidate>(`
        WITH toko_with_refs AS (
            SELECT
                t.id AS id_toko,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.nama_toko,
                t.cabang,
                r.id AS id_rab,
                s.id AS id_spk,
                COALESCE(r.kategori_lokasi, source_pic.kategori_lokasi) AS kategori_lokasi,
                COALESCE(
                    CASE WHEN s.durasi IS NOT NULL THEN concat(s.durasi::text, ' Hari') END,
                    source_pic.durasi
                ) AS durasi,
                COALESCE(s.waktu_mulai::date::text, source_pic.tanggal_mulai_spk) AS tanggal_mulai_spk,
                source_pic.id AS source_pic_id,
                source_pic.plc_building_support
            FROM toko t
            JOIN LATERAL (
                SELECT pic.*
                FROM pic_pengawasan pic
                WHERE UPPER(TRIM(pic.nomor_ulok)) = UPPER(TRIM(t.nomor_ulok))
                ORDER BY CASE WHEN pic.id_toko = t.id THEN 0 ELSE 1 END, pic.id DESC
                LIMIT 1
            ) source_pic ON true
            JOIN LATERAL (
                SELECT id, kategori_lokasi
                FROM rab
                WHERE id_toko = t.id
                  AND UPPER(COALESCE(status, '')) IN ('DISETUJUI', 'APPROVED')
                ORDER BY id DESC
                LIMIT 1
            ) r ON true
            JOIN LATERAL (
                SELECT id, durasi, waktu_mulai
                FROM pengajuan_spk
                WHERE id_toko = t.id
                  AND status = 'SPK_APPROVED'
                ORDER BY id DESC
                LIMIT 1
            ) s ON true
            WHERE NOT EXISTS (
                SELECT 1
                FROM pic_pengawasan existing
                WHERE existing.id_toko = t.id
                   OR existing.id_rab = r.id
                   OR existing.id_spk = s.id
            )
        )
        SELECT *
        FROM toko_with_refs
        ORDER BY cabang, nomor_ulok, lingkup_pekerjaan
    `);

    return result.rows;
};

const findStCandidates = async (): Promise<StCandidate[]> => {
    const result = await pool.query<StCandidate>(`
        SELECT
            t.id AS id_toko,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.nama_toko,
            t.cabang,
            latest_opname.id AS opname_final_id,
            latest_opname.created_at AS opname_created_at,
            latest_opname.link_pdf_opname
        FROM toko t
        JOIN LATERAL (
            SELECT id, created_at, link_pdf_opname
            FROM opname_final
            WHERE id_toko = t.id
              AND tipe_opname = 'OPNAME_FINAL'
              AND (
                  aksi = 'terkunci'
                  OR NULLIF(TRIM(COALESCE(link_pdf_opname, '')), '') IS NOT NULL
              )
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) latest_opname ON true
        WHERE NOT EXISTS (
            SELECT 1
            FROM berkas_serah_terima bst
            WHERE bst.id_toko = t.id
        )
        ORDER BY latest_opname.created_at DESC, t.nomor_ulok, t.lingkup_pekerjaan
    `);

    return result.rows;
};

const commitPicCandidates = async (rows: PicCandidate[]) => {
    if (rows.length === 0) return;

    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pic_pengawasan_scope_repair_audit (
                audit_id SERIAL PRIMARY KEY,
                id_toko INT NOT NULL,
                nomor_ulok TEXT NOT NULL,
                lingkup_pekerjaan TEXT,
                id_rab INT NOT NULL,
                id_spk INT NOT NULL,
                source_pic_id INT NOT NULL,
                plc_building_support TEXT,
                repaired_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        for (const row of rows) {
            const inserted = await client.query<{ id: number }>(
                `
                INSERT INTO pic_pengawasan (
                    id_toko,
                    nomor_ulok,
                    id_rab,
                    id_spk,
                    kategori_lokasi,
                    durasi,
                    tanggal_mulai_spk,
                    plc_building_support
                )
                VALUES ($1, $2, $3, $4, COALESCE($5, '-'), COALESCE($6, '-'), $7::date, COALESCE($8, '-'))
                ON CONFLICT DO NOTHING
                RETURNING id
                `,
                [
                    row.id_toko,
                    row.nomor_ulok,
                    row.id_rab,
                    row.id_spk,
                    row.kategori_lokasi,
                    row.durasi,
                    row.tanggal_mulai_spk,
                    row.plc_building_support,
                ]
            );

            if ((inserted.rowCount ?? 0) > 0) {
                await client.query(
                    `
                    INSERT INTO pic_pengawasan_scope_repair_audit (
                        id_toko,
                        nomor_ulok,
                        lingkup_pekerjaan,
                        id_rab,
                        id_spk,
                        source_pic_id,
                        plc_building_support
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `,
                    [
                        row.id_toko,
                        row.nomor_ulok,
                        row.lingkup_pekerjaan,
                        row.id_rab,
                        row.id_spk,
                        row.source_pic_id,
                        row.plc_building_support,
                    ]
                );
            }
        }
    });
};

const commitStCandidates = async (rows: StCandidate[]) => {
    if (rows.length === 0) return;

    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_from_opname_repair_audit (
                audit_id SERIAL PRIMARY KEY,
                id_toko INT NOT NULL,
                nomor_ulok TEXT NOT NULL,
                lingkup_pekerjaan TEXT,
                opname_final_id INT NOT NULL,
                tanggal_st TIMESTAMP NOT NULL,
                repaired_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        for (const row of rows) {
            const inserted = await client.query<{ id: number }>(
                `
                INSERT INTO berkas_serah_terima (id_toko, link_pdf, created_at)
                SELECT $1, NULL, $2::timestamp
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM berkas_serah_terima
                    WHERE id_toko = $1
                )
                RETURNING id
                `,
                [row.id_toko, row.opname_created_at]
            );

            if ((inserted.rowCount ?? 0) > 0) {
                await client.query(
                    `
                    INSERT INTO serah_terima_from_opname_repair_audit (
                        id_toko,
                        nomor_ulok,
                        lingkup_pekerjaan,
                        opname_final_id,
                        tanggal_st
                    )
                    VALUES ($1, $2, $3, $4, $5::timestamp)
                    `,
                    [
                        row.id_toko,
                        row.nomor_ulok,
                        row.lingkup_pekerjaan,
                        row.opname_final_id,
                        row.opname_created_at,
                    ]
                );
            }
        }
    });

    for (const idToko of [...new Set(rows.map((row) => row.id_toko))]) {
        await opnameFinalService.refreshDendaByTokoId(idToko);
    }
};

const main = async () => {
    const [picCandidates, stCandidates] = await Promise.all([
        findPicCandidates(),
        findStCandidates(),
    ]);

    printTable(
        "PIC scope repair candidates",
        picCandidates.map((row) => ({
            id_toko: row.id_toko,
            nomor_ulok: row.nomor_ulok,
            lingkup: row.lingkup_pekerjaan,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            id_rab: row.id_rab,
            id_spk: row.id_spk,
            source_pic_id: row.source_pic_id,
            pic: row.plc_building_support,
        }))
    );

    printTable(
        "ST from latest opname candidates",
        stCandidates.map((row) => ({
            id_toko: row.id_toko,
            nomor_ulok: row.nomor_ulok,
            lingkup: row.lingkup_pekerjaan,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            opname_final_id: row.opname_final_id,
            tanggal_st: row.opname_created_at,
        }))
    );

    if (!shouldCommit) {
        console.log("\nDry-run selesai. Jalankan dengan --commit untuk menulis perubahan.");
        return;
    }

    await commitPicCandidates(picCandidates);
    await commitStCandidates(stCandidates);
    console.log(`\nCommit selesai. PIC inserted: ${picCandidates.length}, ST inserted/refreshed: ${stCandidates.length}.`);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
