require("dotenv").config();

const { Client } = require("pg");

const base = process.env.DATABASE_URL;
const sep = base.includes("?") ? "&" : "?";
const client = new Client({
    connectionString: `${base}${sep}uselibpqcompat=true&sslmode=require`,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
});

const sipilRabId = 1646;
const sipilTokoId = 898;
const sipilOpnameFinalId = 69;

async function ensureAuditTables() {
    await client.query(`
        CREATE TABLE IF NOT EXISTS rab_item_ktk_fix_audit (
            audit_id BIGSERIAL PRIMARY KEY,
            run_label TEXT NOT NULL,
            rab_item_id INTEGER NOT NULL,
            old_row JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS opname_item_ktk_fix_audit (
            audit_id BIGSERIAL PRIMARY KEY,
            run_label TEXT NOT NULL,
            opname_item_id INTEGER NOT NULL,
            old_row JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
        )
    `);
}

async function backupRabItem(runLabel, rabItemId) {
    const row = await client.query("SELECT * FROM rab_item WHERE id = $1", [rabItemId]);
    if ((row.rowCount ?? 0) === 0) throw new Error(`rab_item ${rabItemId} not found`);
    await client.query(
        `INSERT INTO rab_item_ktk_fix_audit (run_label, rab_item_id, old_row)
         VALUES ($1, $2, $3::jsonb)`,
        [runLabel, rabItemId, JSON.stringify(row.rows[0])]
    );
}

async function backupOpnameItem(runLabel, opnameItemId) {
    const row = await client.query("SELECT * FROM opname_item WHERE id = $1", [opnameItemId]);
    if ((row.rowCount ?? 0) === 0) return;
    await client.query(
        `INSERT INTO opname_item_ktk_fix_audit (run_label, opname_item_id, old_row)
         VALUES ($1, $2, $3::jsonb)`,
        [runLabel, opnameItemId, JSON.stringify(row.rows[0])]
    );
}

async function updateRabItemFromOpname(runLabel, opnameItemId, payload) {
    const source = await client.query(
        `SELECT ri.id
           FROM opname_item oi
           JOIN rab_item ri ON ri.id = oi.id_rab_item
          WHERE oi.id = $1`,
        [opnameItemId]
    );
    if ((source.rowCount ?? 0) === 0) throw new Error(`source rab_item for opname_item ${opnameItemId} not found`);
    const rabItemId = source.rows[0].id;
    await backupRabItem(runLabel, rabItemId);
    await client.query(
        `
        UPDATE rab_item
           SET kategori_pekerjaan = $1,
               jenis_pekerjaan = $2,
               satuan = $3,
               volume = $4,
               harga_material = $5,
               harga_upah = $6,
               total_material = $7,
               total_upah = $8,
               total_harga = $9
         WHERE id = $10
        `,
        [
            payload.kategori,
            payload.jenis,
            payload.satuan,
            payload.volume,
            payload.material,
            payload.upah,
            Math.round(payload.volume * payload.material),
            Math.round(payload.volume * payload.upah),
            Math.round(payload.volume * (payload.material + payload.upah)),
            rabItemId,
        ]
    );
    return rabItemId;
}

async function insertRabItem(payload) {
    const existing = await client.query(
        `
        SELECT id
          FROM rab_item
         WHERE id_rab = $1
           AND LOWER(jenis_pekerjaan) = LOWER($2)
         ORDER BY id
         LIMIT 1
        `,
        [sipilRabId, payload.jenis]
    );
    if ((existing.rowCount ?? 0) > 0) return existing.rows[0].id;

    const inserted = await client.query(
        `
        INSERT INTO rab_item (
            id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan, volume,
            harga_material, harga_upah, total_material, total_upah, total_harga, catatan
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        `,
        [
            sipilRabId,
            payload.kategori,
            payload.jenis,
            payload.satuan,
            payload.volume,
            payload.material,
            payload.upah,
            Math.round(payload.volume * payload.material),
            Math.round(payload.volume * payload.upah),
            Math.round(payload.volume * (payload.material + payload.upah)),
            payload.catatan ?? null,
        ]
    );
    return inserted.rows[0].id;
}

async function upsertOpnameItemForRab(runLabel, rabItemId, payload) {
    const existing = await client.query(
        `
        SELECT id
          FROM opname_item
         WHERE id_opname_final = $1
           AND id_rab_item = $2
         ORDER BY id
         LIMIT 1
        `,
        [sipilOpnameFinalId, rabItemId]
    );

    if ((existing.rowCount ?? 0) > 0) {
        const opnameItemId = existing.rows[0].id;
        await backupOpnameItem(runLabel, opnameItemId);
        await client.query(
            `
            UPDATE opname_item
               SET volume_akhir = $1,
                   selisih_volume = $2,
                   total_selisih = $3,
                   total_harga_opname = $4,
                   catatan = $5
             WHERE id = $6
            `,
            [payload.volumeAkhir, payload.selisih, payload.totalSelisih, payload.totalHargaOpname, payload.catatan, opnameItemId]
        );
        return opnameItemId;
    }

    const inserted = await client.query(
        `
        INSERT INTO opname_item (
            id_toko, id_opname_final, id_rab_item, id_instruksi_lapangan_item,
            status, volume_akhir, selisih_volume, total_selisih,
            total_harga_opname, desain, kualitas, spesifikasi, foto, catatan
        )
        VALUES ($1, $2, $3, NULL, 'disetujui', $4, $5, $6, $7, NULL, NULL, NULL, NULL, $8)
        RETURNING id
        `,
        [sipilTokoId, sipilOpnameFinalId, rabItemId, payload.volumeAkhir, payload.selisih, payload.totalSelisih, payload.totalHargaOpname, payload.catatan]
    );
    return inserted.rows[0].id;
}

async function refreshTotals() {
    await client.query(
        `
        UPDATE rab r
           SET grand_total = totals.grand_total::text,
               grand_total_non_sbo = totals.grand_total::text,
               grand_total_final = (FLOOR(totals.grand_total / 10000) * 10000 * 1.11)::text
          FROM (
                SELECT COALESCE(SUM(total_harga), 0) AS grand_total
                  FROM rab_item
                 WHERE id_rab = $1
               ) totals
         WHERE r.id = $1
        `,
        [sipilRabId]
    );

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
        [sipilOpnameFinalId]
    );
}

(async () => {
    await client.connect();
    await client.query("BEGIN");
    await ensureAuditTables();

    const runLabel = `fix-ktk-add-missing-items-2jz1-1903-0012-r-${new Date().toISOString()}`;

    // Make existing source rows match the photo names/volume/price more closely.
    await updateRabItemFromOpname(runLabel, 2100, {
        kategori: "PEKERJAAN BOBOKAN / BONGKARAN",
        jenis: "Pek. Bongkaran tangga existing",
        satuan: "Ls",
        volume: 1,
        material: 0,
        upah: 1000000,
    });

    await backupOpnameItem(runLabel, 2100);
    await client.query(
        `UPDATE opname_item
            SET volume_akhir = 0, selisih_volume = -1, total_selisih = -1000000,
                total_harga_opname = 0, catatan = $1
          WHERE id = 2100`,
        ["KTK Sipil: kerja kurang bongkaran tangga existing"]
    );

    await updateRabItemFromOpname(runLabel, 2082, {
        kategori: "PEKERJAAN PLUMBING",
        jenis: "Instalasi pipa PVC 4\" tipe D Wavin horizontal untuk air hujan",
        satuan: "M1",
        volume: 4,
        material: 70000,
        upah: 11600,
    });

    await backupOpnameItem(runLabel, 2082);
    await client.query(
        `UPDATE opname_item
            SET volume_akhir = 0, selisih_volume = -4, total_selisih = -326400,
                total_harga_opname = 0, catatan = $1
          WHERE id = 2082`,
        ["KTK Sipil: kerja kurang instalasi pipa PVC 4 D Wavin air hujan"]
    );

    const lampuRabItemId = await insertRabItem({
        kategori: "PEKERJAAN BOBOKAN / BONGKARAN",
        jenis: "Pek. Bongkar pasang Lampu teras existing",
        satuan: "M2",
        volume: 20,
        material: 0,
        upah: 20000,
        catatan: "KTK Sipil missing source item from photo",
    });
    await upsertOpnameItemForRab(runLabel, lampuRabItemId, {
        volumeAkhir: 10,
        selisih: -10,
        totalSelisih: -200000,
        totalHargaOpname: 200000,
        catatan: "KTK Sipil: kerja kurang bongkar pasang lampu teras existing",
    });

    const awRabItemId = await insertRabItem({
        kategori: "PEKERJAAN PLUMBING",
        jenis: "Ps. Pipa PVC 4\" tipe AW Wavin --> untuk Air kotor, septictank",
        satuan: "M1",
        volume: 30,
        material: 114800,
        upah: 11600,
        catatan: "KTK Sipil missing source item from photo",
    });
    await upsertOpnameItemForRab(runLabel, awRabItemId, {
        volumeAkhir: 21.6,
        selisih: -8.4,
        totalSelisih: -1061760,
        totalHargaOpname: 2730240,
        catatan: "KTK Sipil: kerja kurang pipa PVC 4 AW air kotor/septictank",
    });

    // Keep the approved final net aligned to the photo subtotal after splitting rows.
    await backupOpnameItem(runLabel, 2092);
    await client.query(
        `UPDATE opname_item
            SET total_selisih = 339110,
                total_harga_opname = GREATEST(0, COALESCE(total_harga_opname, 0) + 34618),
                catatan = $1
          WHERE id = 2092`,
        ["KTK Sipil: penyesuaian pembulatan subtotal setelah item hilang ditambahkan"]
    );

    await refreshTotals();

    const summary = await client.query(
        `
        SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id,
               SUM(CASE WHEN oi.total_selisih > 0 THEN oi.total_selisih ELSE 0 END) AS kerja_tambah,
               SUM(CASE WHEN oi.total_selisih < 0 THEN oi.total_selisih ELSE 0 END) AS kerja_kurang,
               SUM(oi.total_selisih) AS net_selisih,
               COUNT(*) FILTER (WHERE oi.total_selisih > 0) AS tambah_count,
               COUNT(*) FILTER (WHERE oi.total_selisih < 0) AS kurang_count,
               ofn.grand_total_opname,
               ofn.grand_total_rab
          FROM opname_item oi
          JOIN opname_final ofn ON ofn.id = oi.id_opname_final
          JOIN toko t ON t.id = oi.id_toko
         WHERE ofn.id = $1
         GROUP BY t.lingkup_pekerjaan, ofn.id
        `,
        [sipilOpnameFinalId]
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
