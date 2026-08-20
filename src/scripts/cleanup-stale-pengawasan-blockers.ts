import { pool, withTransaction } from "../db/pool";

type Args = {
    commit: boolean;
    ulok?: string;
    limit?: number;
};

const parseArgs = (): Args => {
    const args = process.argv.slice(2);
    const parsed: Args = { commit: false };

    for (const arg of args) {
        if (arg === "--commit") parsed.commit = true;
        else if (arg.startsWith("--ulok=")) parsed.ulok = arg.slice("--ulok=".length).trim();
        else if (arg.startsWith("--limit=")) {
            const value = Number(arg.slice("--limit=".length));
            if (Number.isFinite(value) && value > 0) parsed.limit = Math.floor(value);
        }
    }

    return parsed;
};

const candidateWhereSql = (hasUlok: boolean) => `
WITH rows AS (
    SELECT
        t.nomor_ulok,
        t.lingkup_pekerjaan,
        t.id AS id_toko,
        g.id AS id_gantt,
        p.id AS id_pengawasan,
        p.id_pengawasan_gantt,
        pg.tanggal_pengawasan,
        to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') AS tgl,
        UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) AS kat_key,
        UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) AS jenis_key,
        p.kategori_pekerjaan,
        p.jenis_pekerjaan,
        LOWER(TRIM(COALESCE(p.status, ''))) AS status,
        p.catatan,
        p.dokumentasi,
        p.dokumentasi_base64,
        p.created_at
    FROM pengawasan p
    JOIN gantt_chart g ON g.id = p.id_gantt
    JOIN toko t ON t.id = g.id_toko
    JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
    ${hasUlok ? "WHERE UPPER(t.nomor_ulok) = UPPER($1)" : ""}
), latest_per_item AS (
    SELECT DISTINCT ON (id_gantt, kat_key, jenis_key) *
    FROM rows
    ORDER BY id_gantt, kat_key, jenis_key, tgl DESC, id_pengawasan DESC
), candidates AS (
    SELECT
        lb.*,
        previous_row.id_pengawasan AS selesai_id,
        previous_row.tanggal_pengawasan AS selesai_tanggal,
        previous_row.created_at AS selesai_created_at
    FROM latest_per_item lb
    JOIN LATERAL (
        SELECT r.*
        FROM rows r
        WHERE r.id_gantt = lb.id_gantt
          AND r.kat_key = lb.kat_key
          AND r.jenis_key = lb.jenis_key
          AND (r.tgl, r.id_pengawasan) < (lb.tgl, lb.id_pengawasan)
        ORDER BY r.tgl DESC, r.id_pengawasan DESC
        LIMIT 1
    ) previous_row ON true
    WHERE lb.status IN ('progress', 'terlambat')
      AND previous_row.status = 'selesai'
      AND previous_row.created_at > lb.created_at
)
SELECT *
FROM candidates
ORDER BY nomor_ulok, lingkup_pekerjaan, kategori_pekerjaan, jenis_pekerjaan, tanggal_pengawasan
`;

const main = async () => {
    const args = parseArgs();
    const values = args.ulok ? [args.ulok] : [];
    const limitSql = args.limit ? ` LIMIT ${args.limit}` : "";
    const candidatesSql = `${candidateWhereSql(Boolean(args.ulok))}${limitSql}`;

    const preview = await pool.query(candidatesSql, values);
    console.log(`Mode: ${args.commit ? "COMMIT" : "DRY-RUN"}`);
    console.log(`Candidates: ${preview.rowCount}`);

    for (const row of preview.rows.slice(0, 30)) {
        console.log([
            row.nomor_ulok,
            row.lingkup_pekerjaan,
            `delete#${row.id_pengawasan}`,
            `${row.tanggal_pengawasan}:${row.status}`,
            `because selesai#${row.selesai_id}@${row.selesai_tanggal}`,
            row.kategori_pekerjaan,
            String(row.jenis_pekerjaan || "").slice(0, 80)
        ].join(" | "));
    }

    if (!args.commit || preview.rowCount === 0) return;

    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pengawasan_stale_blocker_cleanup_audit (
                audit_id bigserial PRIMARY KEY,
                deleted_at timestamptz NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
                reason text NOT NULL,
                nomor_ulok text,
                lingkup_pekerjaan text,
                id_toko integer,
                id_gantt integer,
                id_pengawasan integer NOT NULL,
                id_pengawasan_gantt integer NOT NULL,
                tanggal_pengawasan text,
                kategori_pekerjaan text,
                jenis_pekerjaan text,
                status text,
                catatan text,
                dokumentasi text,
                dokumentasi_base64 text,
                created_at timestamptz,
                selesai_id integer,
                selesai_tanggal text,
                selesai_created_at timestamptz
            )
        `);

        const insertSql = `
            INSERT INTO pengawasan_stale_blocker_cleanup_audit (
                reason, nomor_ulok, lingkup_pekerjaan, id_toko, id_gantt,
                id_pengawasan, id_pengawasan_gantt, tanggal_pengawasan,
                kategori_pekerjaan, jenis_pekerjaan, status, catatan,
                dokumentasi, dokumentasi_base64, created_at,
                selesai_id, selesai_tanggal, selesai_created_at
            )
            SELECT
                'latest unfinished row became stale after later-created older selesai row',
                nomor_ulok, lingkup_pekerjaan, id_toko, id_gantt,
                id_pengawasan, id_pengawasan_gantt, tanggal_pengawasan,
                kategori_pekerjaan, jenis_pekerjaan, status, catatan,
                dokumentasi, dokumentasi_base64, created_at,
                selesai_id, selesai_tanggal, selesai_created_at
            FROM (${candidatesSql}) c
        `;
        await client.query(insertSql, values);

        const deleteSql = `
            DELETE FROM pengawasan p
            USING (${candidatesSql}) c
            WHERE p.id = c.id_pengawasan
            RETURNING p.id
        `;
        const deleted = await client.query(deleteSql, values);
        console.log(`Deleted stale blockers: ${deleted.rowCount}`);
    });
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });