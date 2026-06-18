require("dotenv").config();

const { Client } = require("pg");

const base = process.env.DATABASE_URL;
const sep = base.includes("?") ? "&" : "?";
const client = new Client({
    connectionString: `${base}${sep}uselibpqcompat=true&sslmode=require`,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
});

const updates = [
    // ME - kerja kurang.
    { id: 2120, volume: 0, selisih: -2, total: -417600, note: "KTK ME: tidak dikerjakan - instalasi paralel stop kontak biasa" },
    { id: 2117, volume: 1, selisih: -2, total: -92800, note: "KTK ME: kerja kurang stop kontak biasa" },
    { id: 2116, volume: 1, selisih: -3, total: -146400, note: "KTK ME: kerja kurang saklar tunggal" },
    { id: 2115, volume: 2, selisih: -6, total: -351000, note: "KTK ME: kerja kurang saklar serie" },

    // ME - kerja tambah.
    { id: 2118, volume: 2, selisih: 1, total: 452000, note: "KTK ME: kerja tambah exhaust fan area gudang Lt. 2" },
    { id: 2112, volume: 4, selisih: 2, total: 67600, note: "KTK ME: kerja tambah fitting lampu broco" },
    { id: 2123, volume: 0, selisih: 1, total: 125000, note: "KTK ME: kerja tambah MCB 1 phase 25 A" },
    { id: 2124, volume: 0, selisih: 3.65, total: 373760, note: "KTK ME: kerja tambah openback aluminium 3 inchi" },

    // Sipil - kerja kurang.
    { id: 2100, volume: 0, selisih: -1, total: -1000000, note: "KTK Sipil: padanan bongkaran tangga existing" },
    { id: 2095, volume: 30.3, selisih: -3.12, total: -440856, note: "KTK Sipil: kerja kurang pasangan dinding bata" },
    { id: 2094, volume: 60.6, selisih: -6.24, total: -401856, note: "KTK Sipil: kerja kurang plester aci" },
    { id: 2090, volume: 42.63, selisih: -67.8, total: -2230638, note: "KTK Sipil: kerja kurang CNP 100" },
    { id: 2084, volume: 13.66, selisih: -1.9, total: -125970, note: "KTK Sipil: kerja kurang wiremesh/pengaman dinding" },
    { id: 2086, volume: 431.98, selisih: -85.31, total: -2815302, note: "KTK Sipil: kerja kurang tangga baja" },
    { id: 2067, volume: 12.71, selisih: -33.08, total: -4611747, note: "KTK Sipil: kerja kurang keramik dinding KM/WC" },
    { id: 2091, volume: 1.98, selisih: -11.46, total: -1909549, note: "KTK Sipil: kerja kurang partisi gypsum dua sisi" },
    { id: 2081, volume: 34, selisih: -16, total: -350400, note: "KTK Sipil: kerja kurang instalasi air bersih PVC 3/4" },
    { id: 2082, volume: 17.12, selisih: -16.88, total: -1622778, note: "KTK Sipil: koreksi gabungan plumbing sesuai dokumen referensi" },
    { id: 2075, volume: 0, selisih: -1, total: -2202400, note: "KTK Sipil: kerja kurang sumur resapan" },
    { id: 2073, volume: 31.35, selisih: -4.8, total: -287520, note: "KTK Sipil: kerja kurang nok/flashing zincalume" },
    { id: 2065, volume: 1, selisih: -1, total: -2470000, note: "KTK Sipil: kerja kurang pintu P1 dan P2" },
    { id: 2071, volume: 55.04, selisih: -43.36, total: -936576, note: "KTK Sipil: kerja kurang cat dinding dalam" },
    { id: 2070, volume: 46.69, selisih: -48.11, total: -1178695, note: "KTK Sipil: kerja kurang cat dinding luar" },
    { id: 2069, volume: 4.4, selisih: -34.63, total: -1350570, note: "KTK Sipil: kerja kurang waterproofing No Drop" },
    { id: 2056, volume: 81.72, selisih: -5.53, total: -3467310, note: "KTK Sipil: kerja kurang atap kanopi alderon" },
    { id: 2061, volume: 254.4, selisih: -66.9, total: -2207700, note: "KTK Sipil: kerja kurang grill besi UNP 100" },

    // Sipil - kerja tambah.
    { id: 2099, volume: 4.22, selisih: 1.71, total: 116793, note: "KTK Sipil: kerja tambah galian tanah" },
    { id: 2098, volume: 1.41, selisih: 0.57, total: 19494, note: "KTK Sipil: kerja tambah urug tanah kembali" },
    { id: 2089, volume: 139.87, selisih: 43.21, total: 1425776, note: "KTK Sipil: kerja tambah CNP 150" },
    { id: 2093, volume: 58.5, selisih: 35.5, total: 3862400, note: "KTK Sipil: kerja tambah plafond gypsum" },
    { id: 2092, volume: 16.79, selisih: 2.58, total: 304492, note: "KTK Sipil: kerja tambah partisi gypsum satu sisi" },
    { id: 2079, volume: 4, selisih: 1, total: 108000, note: "KTK Sipil: kerja tambah floor drain" },
    { id: 2074, volume: 23.15, selisih: 8.15, total: 3993500, note: "KTK Sipil: kerja tambah kanopi zincalume" },
    { id: 2064, volume: 3, selisih: 1, total: 1637000, note: "KTK Sipil: kerja tambah pintu kamar mandi UPVC" },
    { id: 2072, volume: 82.7, selisih: 59.7, total: 1289520, note: "KTK Sipil: kerja tambah cat plafond" },
    { id: 2066, volume: 6.36, selisih: 1.06, total: 477000, note: "KTK Sipil: kerja tambah plat perforated" },
    { id: 2110, volume: 0, selisih: 2, total: 2580000, note: "KTK Sipil: kerja tambah banner promo" },
    { id: 2109, volume: 0, selisih: 7.95, total: 201135, note: "KTK Sipil: kerja tambah GRC listplank" },
    { id: 2108, volume: 0, selisih: 0.3, total: 1285200, note: "KTK Sipil: kerja tambah sloof beton" },
    { id: 2107, volume: 0, selisih: 0.29, total: 1268677, note: "KTK Sipil: kerja tambah kolom praktis" },
    { id: 2106, volume: 0, selisih: 110, total: 5104000, note: "KTK Sipil: kerja tambah glassblock/rooster" },
    { id: 2105, volume: 0, selisih: 55.04, total: 1816320, note: "KTK Sipil: kerja tambah WF 150" },
    { id: 2104, volume: 0, selisih: 18.86, total: 829840, note: "KTK Sipil: kerja tambah cat Propan Multipox" },
    { id: 2103, volume: 0, selisih: 8, total: 1248000, note: "KTK Sipil: kerja tambah roda lift" },
];

const opnameFinalIds = [68, 69];

(async () => {
    await client.connect();
    await client.query("BEGIN");

    await client.query(`
        CREATE TABLE IF NOT EXISTS opname_item_ktk_fix_audit (
            audit_id BIGSERIAL PRIMARY KEY,
            run_label TEXT NOT NULL,
            opname_item_id INTEGER NOT NULL,
            old_row JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
        )
    `);

    const runLabel = `fix-ktk-2jz1-1903-0012-r-${new Date().toISOString()}`;
    const ids = updates.map((item) => item.id);

    const existing = await client.query(
        `
        SELECT oi.*
        FROM opname_item oi
        JOIN toko t ON t.id = oi.id_toko
        WHERE t.nomor_ulok = $1
          AND oi.id = ANY($2::int[])
        ORDER BY oi.id
        `,
        ["2JZ1-1903-0012-R", ids]
    );

    if (existing.rowCount !== updates.length) {
        throw new Error(`Expected ${updates.length} target rows, found ${existing.rowCount}`);
    }

    for (const row of existing.rows) {
        await client.query(
            `INSERT INTO opname_item_ktk_fix_audit (run_label, opname_item_id, old_row)
             VALUES ($1, $2, $3::jsonb)`,
            [runLabel, row.id, JSON.stringify(row)]
        );
    }

    for (const item of updates) {
        await client.query(
            `
            UPDATE opname_item
               SET volume_akhir = $1,
                   selisih_volume = $2,
                   total_selisih = $3,
                   total_harga_opname = GREATEST(0, COALESCE(total_harga_opname, 0) + $3),
                   catatan = $4
             WHERE id = $5
            `,
            [item.volume, item.selisih, item.total, item.note, item.id]
        );
    }

    for (const opnameFinalId of opnameFinalIds) {
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
                     WHERE oi.id_opname_final = $1
                   ) totals
             WHERE ofn.id = $1
            `,
            [opnameFinalId]
        );
    }

    const summary = await client.query(
        `
        SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id,
               SUM(CASE WHEN oi.total_selisih > 0 THEN oi.total_selisih ELSE 0 END) AS kerja_tambah,
               SUM(CASE WHEN oi.total_selisih < 0 THEN oi.total_selisih ELSE 0 END) AS kerja_kurang,
               SUM(oi.total_selisih) AS net_selisih,
               ofn.grand_total_opname
          FROM opname_item oi
          JOIN opname_final ofn ON ofn.id = oi.id_opname_final
          JOIN toko t ON t.id = oi.id_toko
         WHERE ofn.id = ANY($1::int[])
         GROUP BY t.lingkup_pekerjaan, ofn.id
         ORDER BY t.lingkup_pekerjaan
        `,
        [opnameFinalIds]
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
