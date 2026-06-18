require("dotenv").config();

const { Client } = require("pg");

const base = process.env.DATABASE_URL;
const sep = base.includes("?") ? "&" : "?";
const client = new Client({
    connectionString: `${base}${sep}uselibpqcompat=true&sslmode=require`,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
});

(async () => {
    await client.connect();
    await client.query("BEGIN");

    const runLabel = `fix-ktk-balance-after-add-2jz1-1903-0012-r-${new Date().toISOString()}`;

    const aw = await client.query(
        `
        SELECT oi.id
          FROM opname_item oi
          JOIN rab_item ri ON ri.id = oi.id_rab_item
         WHERE oi.id_opname_final = 69
           AND LOWER(ri.jenis_pekerjaan) = LOWER($1)
         ORDER BY oi.id
         LIMIT 1
        `,
        ['Ps. Pipa PVC 4" tipe AW Wavin --> untuk Air kotor, septictank']
    );
    if ((aw.rowCount ?? 0) === 0) throw new Error("AW plumbing opname item not found");

    const targets = [
        { id: 2092, total: 304492, note: "KTK Sipil: kerja tambah partisi gypsum satu sisi" },
        { id: aw.rows[0].id, total: -1096378, note: "KTK Sipil: kerja kurang pipa PVC 4 AW air kotor/septictank - balance subtotal foto" },
    ];

    for (const target of targets) {
        const oldRow = await client.query("SELECT * FROM opname_item WHERE id = $1", [target.id]);
        await client.query(
            `INSERT INTO opname_item_ktk_fix_audit (run_label, opname_item_id, old_row)
             VALUES ($1, $2, $3::jsonb)`,
            [runLabel, target.id, JSON.stringify(oldRow.rows[0])]
        );
        await client.query(
            `UPDATE opname_item
                SET total_selisih = $1,
                    catatan = $2
              WHERE id = $3`,
            [target.total, target.note, target.id]
        );
    }

    await client.query(
        `
        UPDATE opname_final ofn
           SET grand_total_opname = totals.grand_total_opname,
               grand_total_rab = totals.grand_total_rab
          FROM (
                SELECT
                    COALESCE(SUM(oi.total_selisih), 0)::text AS grand_total_opname,
                    COALESCE(SUM(ri.total_harga), 0)::text AS grand_total_rab
                  FROM opname_item oi
             LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                 WHERE oi.id_opname_final = 69
               ) totals
         WHERE ofn.id = 69
        `
    );

    const summary = await client.query(
        `
        SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id,
               SUM(CASE WHEN oi.total_selisih > 0 THEN oi.total_selisih ELSE 0 END) AS kerja_tambah,
               SUM(CASE WHEN oi.total_selisih < 0 THEN oi.total_selisih ELSE 0 END) AS kerja_kurang,
               SUM(oi.total_selisih) AS net_selisih,
               COUNT(*) FILTER (WHERE oi.total_selisih > 0) AS tambah_count,
               COUNT(*) FILTER (WHERE oi.total_selisih < 0) AS kurang_count,
               ofn.grand_total_opname
          FROM opname_item oi
          JOIN opname_final ofn ON ofn.id = oi.id_opname_final
          JOIN toko t ON t.id = oi.id_toko
         WHERE ofn.id = 69
         GROUP BY t.lingkup_pekerjaan, ofn.id
        `
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({ runLabel, summary: summary.rows }, null, 2));
})()
    .catch(async (error) => {
        await client.query("ROLLBACK").catch(() => {});
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end().catch(() => {});
    });
