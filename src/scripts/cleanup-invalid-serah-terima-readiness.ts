import { pool, withTransaction } from "../db/pool";

const args = process.argv.slice(2);
const shouldCommit = args.includes("--commit");
const includeNoPengawasan = args.includes("--include-no-pengawasan");
const ulokArg = args.find((arg) => arg.startsWith("--ulok="))?.slice("--ulok=".length).trim();

type InvalidSerahTerimaRow = {
    berkas_serah_terima_id: number;
    id_toko: number;
    link_pdf: string | null;
    st_created_at: string;
    nomor_ulok: string | null;
    nama_toko: string | null;
    cabang: string | null;
    lingkup_pekerjaan: string | null;
    opname_final_id: number | null;
    old_hari_denda: number | null;
    old_nilai_denda: string | null;
    old_tanggal_akhir_spk_denda: string | null;
    old_tanggal_serah_terima_denda: string | null;
    total_latest_checkpoints: number;
    incomplete_checkpoints: number;
    total_finished_checkpoints: number;
    missing_checkpoints: number;
    opname_item_count: number;
    cleanup_reason: string;
};

const candidateSql = `
WITH target_toko AS (
    SELECT DISTINCT t.id AS id_toko
    FROM berkas_serah_terima bst
    JOIN toko t ON t.id = bst.id_toko
    WHERE bst.link_pdf IS NOT NULL
      AND ($1::text IS NULL OR UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM($1::text)))
),
latest_gantt AS (
    SELECT DISTINCT ON (id_toko)
        id_toko,
        id AS gantt_id
    FROM gantt_chart
    WHERE id_toko IN (SELECT id_toko FROM target_toko)
    ORDER BY id_toko, id DESC
),
latest_pengawasan AS (
    SELECT DISTINCT ON (
        lg.id_toko,
        UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
        UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
    )
        lg.id_toko,
        p.kategori_pekerjaan,
        p.jenis_pekerjaan,
        p.status
    FROM latest_gantt lg
    JOIN pengawasan p ON p.id_gantt = lg.gantt_id
    LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
    ORDER BY
        lg.id_toko,
        UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
        UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
        to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
        p.id DESC
),
opname_keys AS (
    SELECT DISTINCT
        oi.id_toko,
        UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) AS kategori_key,
        UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) AS jenis_key
    FROM opname_item oi
    LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
    LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
    WHERE oi.id_toko IN (SELECT id_toko FROM target_toko)
),
work_keys AS (
    SELECT DISTINCT
        r.id_toko,
        UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ''))) AS kategori_key,
        UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ''))) AS jenis_key
    FROM rab r
    JOIN rab_item ri ON ri.id_rab = r.id
    WHERE r.id_toko IN (SELECT id_toko FROM target_toko)
    UNION
    SELECT DISTINCT
        il.id_toko,
        UPPER(TRIM(COALESCE(ili.kategori_pekerjaan, ''))) AS kategori_key,
        UPPER(TRIM(COALESCE(ili.jenis_pekerjaan, ''))) AS jenis_key
    FROM instruksi_lapangan il
    JOIN instruksi_lapangan_item ili ON ili.id_instruksi_lapangan = il.id
    WHERE il.id_toko IN (SELECT id_toko FROM target_toko)
),
completion AS (
    SELECT
        lp.id_toko,
        COUNT(*)::int AS total_latest_checkpoints,
        COUNT(*) FILTER (WHERE COALESCE(lp.status, '') <> 'selesai')::int AS incomplete_checkpoints,
        COUNT(*) FILTER (WHERE lp.status = 'selesai')::int AS total_finished_checkpoints,
        COUNT(*) FILTER (
            WHERE lp.status = 'selesai'
              AND wk.id_toko IS NOT NULL
              AND ok.id_toko IS NULL
        )::int AS missing_checkpoints
    FROM latest_pengawasan lp
    LEFT JOIN work_keys wk
      ON wk.id_toko = lp.id_toko
     AND wk.kategori_key = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
     AND wk.jenis_key = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
    LEFT JOIN opname_keys ok
      ON ok.id_toko = lp.id_toko
     AND ok.kategori_key = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
     AND ok.jenis_key = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
    GROUP BY lp.id_toko
),
st AS (
    SELECT
        bst.id AS berkas_serah_terima_id,
        bst.id_toko,
        bst.link_pdf,
        bst.created_at AS st_created_at,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        t.lingkup_pekerjaan,
        ofn.id AS opname_final_id,
        ofn.hari_denda AS old_hari_denda,
        ofn.nilai_denda AS old_nilai_denda,
        ofn.tanggal_akhir_spk_denda AS old_tanggal_akhir_spk_denda,
        ofn.tanggal_serah_terima_denda AS old_tanggal_serah_terima_denda,
        COALESCE(c.total_latest_checkpoints, 0)::int AS total_latest_checkpoints,
        COALESCE(c.incomplete_checkpoints, 0)::int AS incomplete_checkpoints,
        COALESCE(c.total_finished_checkpoints, 0)::int AS total_finished_checkpoints,
        COALESCE(c.missing_checkpoints, 0)::int AS missing_checkpoints,
        COALESCE((
            SELECT COUNT(*)
            FROM opname_item oi
            WHERE oi.id_opname_final = ofn.id
        ), 0)::int AS opname_item_count
    FROM berkas_serah_terima bst
    JOIN toko t ON t.id = bst.id_toko
    LEFT JOIN LATERAL (
        SELECT *
        FROM opname_final
        WHERE id_toko = t.id
        ORDER BY id DESC
        LIMIT 1
    ) ofn ON true
    LEFT JOIN completion c ON c.id_toko = t.id
    WHERE bst.link_pdf IS NOT NULL
      AND bst.id_toko IN (SELECT id_toko FROM target_toko)
      AND ($1::text IS NULL OR UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM($1::text)))
)
SELECT
    *,
    CONCAT_WS('; ',
        CASE WHEN opname_final_id IS NULL THEN 'opname_final belum ada' END,
        CASE WHEN opname_final_id IS NOT NULL AND opname_item_count = 0 THEN 'opname_item belum ada' END,
        CASE WHEN total_latest_checkpoints = 0 THEN 'latest pengawasan belum ada' END,
        CASE WHEN incomplete_checkpoints > 0 THEN incomplete_checkpoints || ' latest pengawasan belum selesai' END,
        CASE WHEN missing_checkpoints > 0 THEN missing_checkpoints || ' pekerjaan selesai belum masuk opname' END
    ) AS cleanup_reason
FROM st
WHERE opname_final_id IS NULL
   OR opname_item_count = 0
   OR ($2::boolean AND total_latest_checkpoints = 0)
   OR incomplete_checkpoints > 0
   OR missing_checkpoints > 0
ORDER BY st_created_at DESC, berkas_serah_terima_id DESC
`;

const loadCandidates = async (): Promise<InvalidSerahTerimaRow[]> => {
    const result = await pool.query<InvalidSerahTerimaRow>(candidateSql, [ulokArg || null, includeNoPengawasan]);
    return result.rows;
};

const main = async () => {
    const candidates = await loadCandidates();
    const summary = {
        mode: shouldCommit ? "commit" : "dry-run",
        ulok: ulokArg || null,
        include_no_pengawasan: includeNoPengawasan,
        invalid_st_count: candidates.length,
        by_reason: candidates.reduce<Record<string, number>>((acc, row) => {
            acc[row.cleanup_reason] = (acc[row.cleanup_reason] ?? 0) + 1;
            return acc;
        }, {}),
        sample: candidates.slice(0, 25).map((row) => ({
            berkas_serah_terima_id: row.berkas_serah_terima_id,
            nomor_ulok: row.nomor_ulok,
            lingkup_pekerjaan: row.lingkup_pekerjaan,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            total_latest_checkpoints: row.total_latest_checkpoints,
            incomplete_checkpoints: row.incomplete_checkpoints,
            missing_checkpoints: row.missing_checkpoints,
            opname_final_id: row.opname_final_id,
            opname_item_count: row.opname_item_count,
            cleanup_reason: row.cleanup_reason,
        })),
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!shouldCommit || candidates.length === 0) return;

    const ids = candidates.map((row) => row.berkas_serah_terima_id);
    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_invalid_readiness_cleanup_audit (
                audit_id SERIAL PRIMARY KEY,
                berkas_serah_terima_id INT NOT NULL,
                id_toko INT NOT NULL,
                nomor_ulok TEXT,
                nama_toko TEXT,
                cabang TEXT,
                lingkup_pekerjaan TEXT,
                link_pdf TEXT,
                st_created_at TIMESTAMP,
                opname_final_id INT,
                old_hari_denda INT,
                old_nilai_denda NUMERIC,
                old_tanggal_akhir_spk_denda DATE,
                old_tanggal_serah_terima_denda DATE,
                total_latest_checkpoints INT NOT NULL,
                incomplete_checkpoints INT NOT NULL,
                total_finished_checkpoints INT NOT NULL,
                missing_checkpoints INT NOT NULL,
                opname_item_count INT NOT NULL,
                cleanup_reason TEXT NOT NULL,
                cleaned_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        await client.query(
            `
            INSERT INTO serah_terima_invalid_readiness_cleanup_audit (
                berkas_serah_terima_id,
                id_toko,
                nomor_ulok,
                nama_toko,
                cabang,
                lingkup_pekerjaan,
                link_pdf,
                st_created_at,
                opname_final_id,
                old_hari_denda,
                old_nilai_denda,
                old_tanggal_akhir_spk_denda,
                old_tanggal_serah_terima_denda,
                total_latest_checkpoints,
                incomplete_checkpoints,
                total_finished_checkpoints,
                missing_checkpoints,
                opname_item_count,
                cleanup_reason
            )
            SELECT
                berkas_serah_terima_id,
                id_toko,
                nomor_ulok,
                nama_toko,
                cabang,
                lingkup_pekerjaan,
                link_pdf,
                st_created_at,
                opname_final_id,
                old_hari_denda,
                old_nilai_denda,
                old_tanggal_akhir_spk_denda,
                old_tanggal_serah_terima_denda,
                total_latest_checkpoints,
                incomplete_checkpoints,
                total_finished_checkpoints,
                missing_checkpoints,
                opname_item_count,
                cleanup_reason
            FROM (${candidateSql}) candidates
            WHERE berkas_serah_terima_id = ANY($3::int[])
            `,
            [ulokArg || null, includeNoPengawasan, ids]
        );

        await client.query(
            `
            DELETE FROM berkas_serah_terima
            WHERE id = ANY($1::int[])
            `,
            [ids]
        );

        await client.query(
            `
            UPDATE opname_final ofn
            SET hari_denda = 0,
                nilai_denda = 0,
                tanggal_akhir_spk_denda = NULL,
                tanggal_serah_terima_denda = NULL
            WHERE ofn.id_toko = ANY($1::int[])
              AND NOT EXISTS (
                SELECT 1
                FROM berkas_serah_terima bst
                WHERE bst.id_toko = ofn.id_toko
              )
            `,
            [[...new Set(candidates.map((row) => row.id_toko))]]
        );
    });

    console.log(`Cleanup committed. Deleted ${ids.length} invalid berkas_serah_terima rows.`);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
