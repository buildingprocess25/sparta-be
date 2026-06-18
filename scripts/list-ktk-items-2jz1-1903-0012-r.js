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
    const result = await client.query(`
        SELECT
            t.lingkup_pekerjaan,
            ofn.id AS opname_final_id,
            oi.id AS opname_item_id,
            ri.id AS rab_item_id,
            ili.id AS il_item_id,
            COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan) AS kategori,
            COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan) AS jenis,
            COALESCE(ri.satuan, ili.satuan) AS satuan,
            COALESCE(ri.volume::text, ili.volume::text) AS volume_ref,
            COALESCE(ri.harga_material::text, ili.harga_material::text) AS material,
            COALESCE(ri.harga_upah::text, ili.harga_upah::text) AS upah,
            oi.volume_akhir,
            oi.selisih_volume,
            oi.total_selisih
        FROM opname_item oi
        JOIN opname_final ofn ON ofn.id = oi.id_opname_final
        JOIN toko t ON t.id = oi.id_toko
        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
        WHERE t.nomor_ulok = $1
        ORDER BY t.lingkup_pekerjaan, oi.id
    `, ["2JZ1-1903-0012-R"]);

    for (const row of result.rows) {
        console.log([
            row.lingkup_pekerjaan,
            row.opname_item_id,
            row.kategori,
            row.volume_ref,
            row.material,
            row.upah,
            row.jenis,
        ].join(" | "));
    }
})()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end().catch(() => {});
    });
