require("dotenv").config();

const { Client } = require("pg");

const ulok = "2JZ1-1903-0012-R";
const base = process.env.DATABASE_URL;
const sep = base.includes("?") ? "&" : "?";

const client = new Client({
    connectionString: `${base}${sep}uselibpqcompat=true&sslmode=require`,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
});

async function q(name, sql, params = [ulok]) {
    const result = await client.query(sql, params);
    console.log(`\n${name}`);
    console.log(JSON.stringify(result.rows, null, 2));
}

(async () => {
    await client.connect();

    await q(
        "TOKO",
        `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, cabang
           FROM toko
          WHERE nomor_ulok = $1
          ORDER BY id`
    );

    await q(
        "RAB",
        `SELECT r.id, r.id_toko, t.lingkup_pekerjaan, r.status, r.grand_total,
                r.grand_total_final, COUNT(ri.id) AS item_count
           FROM rab r
           JOIN toko t ON t.id = r.id_toko
      LEFT JOIN rab_item ri ON ri.id_rab = r.id
          WHERE t.nomor_ulok = $1
          GROUP BY r.id, t.lingkup_pekerjaan
          ORDER BY r.id`
    );

    await q(
        "OPNAME_FINAL",
        `SELECT ofn.id, ofn.id_toko, t.lingkup_pekerjaan, ofn.tipe_opname,
                ofn.aksi, ofn.status_opname_final, ofn.grand_total_opname,
                ofn.grand_total_rab
           FROM opname_final ofn
           JOIN toko t ON t.id = ofn.id_toko
          WHERE t.nomor_ulok = $1
          ORDER BY ofn.id`
    );

    await q(
        "OPNAME_SUMMARY",
        `SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id, COUNT(*) AS item_count,
                SUM(CASE WHEN oi.total_selisih > 0 THEN 1 ELSE 0 END) AS tambah_count,
                SUM(CASE WHEN oi.total_selisih < 0 THEN 1 ELSE 0 END) AS kurang_count,
                SUM(oi.total_selisih) AS total_selisih
           FROM opname_item oi
           JOIN opname_final ofn ON ofn.id = oi.id_opname_final
           JOIN toko t ON t.id = oi.id_toko
          WHERE t.nomor_ulok = $1
          GROUP BY t.lingkup_pekerjaan, ofn.id
          ORDER BY ofn.id`
    );

    await q(
        "OPNAME_ITEMS_NONZERO",
        `SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id, oi.id,
                COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan) AS jenis_pekerjaan,
                COALESCE(ri.satuan, ili.satuan) AS satuan,
                COALESCE(ri.volume::text, ili.volume::text) AS volume_ref,
                oi.volume_akhir, oi.selisih_volume, oi.total_selisih
           FROM opname_item oi
           JOIN opname_final ofn ON ofn.id = oi.id_opname_final
           JOIN toko t ON t.id = oi.id_toko
      LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
      LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
          WHERE t.nomor_ulok = $1
            AND ($2::boolean = true OR oi.total_selisih <> 0)
          ORDER BY t.lingkup_pekerjaan, ofn.id, oi.id`
        ,
        [ulok, true]
    );

    await q(
        "IL",
        `SELECT t.lingkup_pekerjaan, il.id, il.status, il.grand_total,
                il.grand_total_final, COUNT(ili.id) AS item_count
           FROM instruksi_lapangan il
           JOIN toko t ON t.id = il.id_toko
      LEFT JOIN instruksi_lapangan_item ili ON ili.id_instruksi_lapangan = il.id
          WHERE t.nomor_ulok = $1
          GROUP BY t.lingkup_pekerjaan, il.id
          ORDER BY il.id`
    );
})()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end().catch(() => {});
    });
