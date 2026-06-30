import dotenv from "dotenv";

dotenv.config({ path: "../sparta-be.env" });

type SourceItem = {
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: string;
    harga_material: string;
    harga_upah: string;
    total_material: string;
    total_upah: string;
    total_harga: string;
};

const TARGET_ULOK = "HZ01-2604-H168-R";
const TARGET_NAME = "UNTUNG SUROPATI SMG";
const TARGET_TOTAL = 16_661_160;
const TARGET_FINAL = 18_492_600;

const sourceItems: SourceItem[] = [
    { kategori_pekerjaan: "PEKERJAAN PERSIAPAN", jenis_pekerjaan: "Pembersihan lokasi", satuan: "Ls", volume: "1", harga_material: "0", harga_upah: "1500000", total_material: "0", total_upah: "1500000", total_harga: "1500000" },
    { kategori_pekerjaan: "PEKERJAAN BOBOKAN / BONGKARAN", jenis_pekerjaan: "Bongkaran & buang puing bekas pekerjaan renovasi", satuan: "Ls", volume: "1", harga_material: "0", harga_upah: "3500000", total_material: "0", total_upah: "3500000", total_harga: "3500000" },
    { kategori_pekerjaan: "PEKERJAAN TANAH", jenis_pekerjaan: "Galian tanah", satuan: "M3", volume: "0.3", harga_material: "0", harga_upah: "65000", total_material: "0", total_upah: "19500", total_harga: "19500" },
    { kategori_pekerjaan: "PEKERJAAN TANAH", jenis_pekerjaan: "Urug tanah kembali", satuan: "M3", volume: "0.1", harga_material: "0", harga_upah: "36500", total_material: "0", total_upah: "3650", total_harga: "3650" },
    { kategori_pekerjaan: "PEKERJAAN PONDASI & BETON", jenis_pekerjaan: "Pondasi rolaq bata, 1 pc : 6 ps", satuan: "M1", volume: "3.75", harga_material: "24000", harga_upah: "27500", total_material: "90000", total_upah: "103125", total_harga: "193125" },
    { kategori_pekerjaan: "PEKERJAAN PASANGAN", jenis_pekerjaan: "Pasangan dinding bata, 1 pc : 6 ps", satuan: "M2", volume: "0.66", harga_material: "110000", harga_upah: "30000", total_material: "72600", total_upah: "19800", total_harga: "92400" },
    { kategori_pekerjaan: "PEKERJAAN PASANGAN", jenis_pekerjaan: "Plester + aci untuk pasangan dinding bata 1 pc : 6 ps", satuan: "M2", volume: "24.44", harga_material: "30000", harga_upah: "35000", total_material: "733200", total_upah: "855400", total_harga: "1588600" },
    { kategori_pekerjaan: "PEKERJAAN KERAMIK", jenis_pekerjaan: "Pasang keramik lantai KM / WC 60x60 merk Platinum Sicily Dark Grey**Nat menggunakan semen (portland cement)", satuan: "M2", volume: "3.42", harga_material: "150000", harga_upah: "43000", total_material: "513000", total_upah: "147060", total_harga: "660060" },
    { kategori_pekerjaan: "PEKERJAAN KERAMIK", jenis_pekerjaan: "Pasang keramik dinding KM / WC 30x60 merk Platinum Bonza white **Nat menggunakan semen (portland cement)", satuan: "M2", volume: "20.63", harga_material: "144000", harga_upah: "45000", total_material: "2970720", total_upah: "928350", total_harga: "3899070" },
    { kategori_pekerjaan: "PEKERJAAN PLUMBING", jenis_pekerjaan: "Instalasi pipa PVC 4\" tipe D Wavin horizontal", satuan: "M1", volume: "2", harga_material: "75000", harga_upah: "8500", total_material: "150000", total_upah: "17000", total_harga: "167000" },
    { kategori_pekerjaan: "PEKERJAAN PLUMBING", jenis_pekerjaan: "Instalasi air bersih pipa PVC 3/4 inch tipe AW Wavin / Rucika (include aksesoris)", satuan: "M1", volume: "4", harga_material: "18000", harga_upah: "6500", total_material: "72000", total_upah: "26000", total_harga: "98000" },
    { kategori_pekerjaan: "PEKERJAAN SANITARY & ACECORIES", jenis_pekerjaan: "Pasang closet jongkok merk Toto CE7 warna putih", satuan: "Bh", volume: "1", harga_material: "417500", harga_upah: "110000", total_material: "417500", total_upah: "110000", total_harga: "527500" },
    { kategori_pekerjaan: "PEKERJAAN SANITARY & ACECORIES", jenis_pekerjaan: "Kran air merk Onda tipe CLS", satuan: "Bh", volume: "1", harga_material: "92000", harga_upah: "8000", total_material: "92000", total_upah: "8000", total_harga: "100000" },
    { kategori_pekerjaan: "PEKERJAAN SANITARY & ACECORIES", jenis_pekerjaan: "Floor drain kotak stainless berlubang ukuran 5 mm, dimensi 10x10 cm", satuan: "Bh", volume: "1", harga_material: "56000", harga_upah: "17000", total_material: "56000", total_upah: "17000", total_harga: "73000" },
    { kategori_pekerjaan: "PEKERJAAN JANITOR", jenis_pekerjaan: "a. Pasangan batu bata", satuan: "M2", volume: "0.48", harga_material: "110000", harga_upah: "30000", total_material: "52800", total_upah: "14400", total_harga: "67200" },
    { kategori_pekerjaan: "PEKERJAAN JANITOR", jenis_pekerjaan: "b. Pasangan Keramik 40x40 merk Asia Tile tinggi: 1,6 m", satuan: "M2", volume: "5.31", harga_material: "109000", harga_upah: "43000", total_material: "578790", total_upah: "228330", total_harga: "807120" },
    { kategori_pekerjaan: "PEKERJAAN JANITOR", jenis_pekerjaan: "c. Kran air merk Onda tipe CLS.", satuan: "Bh", volume: "1", harga_material: "92000", harga_upah: "8000", total_material: "92000", total_upah: "8000", total_harga: "100000" },
    { kategori_pekerjaan: "PEKERJAAN JANITOR", jenis_pekerjaan: "d. Floor drain kotak stainless berlubang ukuran 5 mm dimensi 10x10 cm", satuan: "Bh", volume: "2", harga_material: "56000", harga_upah: "17000", total_material: "112000", total_upah: "34000", total_harga: "146000" },
    { kategori_pekerjaan: "PEKERJAAN FINISHING", jenis_pekerjaan: "Cat dinding dalam merk Avitek interior white", satuan: "M2", volume: "13.15", harga_material: "13500", harga_upah: "7500", total_material: "177525", total_upah: "98625", total_harga: "276150" },
    { kategori_pekerjaan: "PEKERJAAN FINISHING", jenis_pekerjaan: "Cat plafond merk Avitek interior white", satuan: "M2", volume: "10", harga_material: "13500", harga_upah: "7500", total_material: "135000", total_upah: "75000", total_harga: "210000" },
    { kategori_pekerjaan: "PEKERJAAN FINISHING", jenis_pekerjaan: "Cat Propan Multipox MX 99 Light Grey", satuan: "M2", volume: "15.55", harga_material: "48000", harga_upah: "7500", total_material: "746400", total_upah: "116625", total_harga: "863025" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Pasang keramik lantai 40x40 merk Asia Tile tipe Oscar Grey untuk teras**Nat menggunakan semen (portland cement)", satuan: "M2", volume: "0.72", harga_material: "115000", harga_upah: "43000", total_material: "82800", total_upah: "30960", total_harga: "113760" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Gantungan baju double hook Merk Onda ARH 105 / gantungan handuk / gantungan baju", satuan: "Unit", volume: "1", harga_material: "189000", harga_upah: "21000", total_material: "189000", total_upah: "21000", total_harga: "210000" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Tempat alat kebersihan merk AZKO Stora Organizer Sapu & Alat Pel 6 Hook - Hitam Broom And Mop Holder Tempat Sapu Dan Pel Organizer Alat Kebersihan", satuan: "Unit", volume: "1", harga_material: "135000", harga_upah: "21000", total_material: "135000", total_upah: "21000", total_harga: "156000" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Tempat sampah tutup goyang ukuran 5 liter", satuan: "Bh", volume: "1", harga_material: "30000", harga_upah: "0", total_material: "30000", total_upah: "0", total_harga: "30000" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Gayung gagang bulat warna abu-abu", satuan: "Bh", volume: "1", harga_material: "15000", harga_upah: "0", total_material: "15000", total_upah: "0", total_harga: "15000" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Ember 30 liter warna abu-abu", satuan: "Bh", volume: "1", harga_material: "60000", harga_upah: "0", total_material: "60000", total_upah: "0", total_harga: "60000" },
    { kategori_pekerjaan: "PEKERJAAN TAMBAHAN", jenis_pekerjaan: "Pintu Kamar Mandi UPVC full panel menggunakan handle + kunci knob ukuran 70x200 cm Warna Putih**include accesories", satuan: "Unit", volume: "1", harga_material: "1050000", harga_upah: "135000", total_material: "1050000", total_upah: "135000", total_harga: "1185000" },
];

const toNumber = (value: string) => Number(value);

async function main() {
    const commit = process.argv.includes("--commit");
    const { pool } = await import("../db/pool");
    const sourceTotal = sourceItems.reduce((sum, item) => sum + toNumber(item.total_harga), 0);
    const sourceMaterial = sourceItems.reduce((sum, item) => sum + toNumber(item.total_material), 0);
    const sourceUpah = sourceItems.reduce((sum, item) => sum + toNumber(item.total_upah), 0);

    if (sourceTotal !== TARGET_TOTAL) {
        throw new Error(`Source total mismatch: ${sourceTotal} !== ${TARGET_TOTAL}`);
    }

    const candidates = await pool.query(
        `
        SELECT
            r.id AS rab_id,
            r.id_toko,
            t.nomor_ulok,
            t.nama_toko,
            r.status,
            r.email_pembuat,
            r.grand_total,
            r.grand_total_final,
            COUNT(ri.id)::int AS item_count,
            COALESCE(SUM(ri.total_harga), 0)::int AS item_total
        FROM rab r
        JOIN toko t ON t.id = r.id_toko
        LEFT JOIN rab_item ri ON ri.id_rab = r.id
        WHERE UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM($1))
        GROUP BY r.id, t.nomor_ulok, t.nama_toko
        ORDER BY r.id
        `,
        [TARGET_ULOK]
    );

    console.log(JSON.stringify({
        mode: commit ? "commit" : "preview",
        target_ulok: TARGET_ULOK,
        target_name: TARGET_NAME,
        target_total: TARGET_TOTAL,
        target_final: TARGET_FINAL,
        source_count: sourceItems.length,
        source_material: sourceMaterial,
        source_upah: sourceUpah,
        source_total: sourceTotal,
        candidates: candidates.rows,
    }, null, 2));

    const target = candidates.rows.find((row: any) =>
        String(row.status).trim().toUpperCase() === "DISETUJUI" &&
        Number(row.grand_total) === TARGET_TOTAL &&
        Number(row.grand_total_final) === TARGET_FINAL &&
        Number(row.item_count) === 0
    );

    if (!commit) {
        await pool.end();
        return;
    }

    if (!target) {
        throw new Error("Target RAB approved kosong tidak ditemukan atau guard total tidak cocok.");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
            CREATE TABLE IF NOT EXISTS rab_item_repair_audit (
                rab_id INT PRIMARY KEY,
                nomor_ulok TEXT NOT NULL,
                nama_toko TEXT,
                source_note TEXT NOT NULL,
                inserted_count INT NOT NULL,
                source_total NUMERIC NOT NULL,
                repaired_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        const existing = await client.query("SELECT 1 FROM rab_item WHERE id_rab = $1 LIMIT 1", [target.rab_id]);
        if ((existing.rowCount ?? 0) > 0) {
            throw new Error(`RAB ${target.rab_id} sudah memiliki item, batal insert.`);
        }

        for (const item of sourceItems) {
            await client.query(
                `
                INSERT INTO rab_item (
                    id_rab,
                    kategori_pekerjaan,
                    jenis_pekerjaan,
                    satuan,
                    volume,
                    harga_material,
                    harga_upah,
                    total_material,
                    total_upah,
                    total_harga,
                    catatan
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
                `,
                [
                    target.rab_id,
                    item.kategori_pekerjaan,
                    item.jenis_pekerjaan,
                    item.satuan,
                    item.volume,
                    item.harga_material,
                    item.harga_upah,
                    item.total_material,
                    item.total_upah,
                    item.total_harga,
                ]
            );
        }

        await client.query(
            `
            INSERT INTO rab_item_repair_audit (
                rab_id,
                nomor_ulok,
                nama_toko,
                source_note,
                inserted_count,
                source_total
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (rab_id) DO NOTHING
            `,
            [
                target.rab_id,
                TARGET_ULOK,
                TARGET_NAME,
                "Backfill dari PDF snapshot DB lama non_sbo untuk RAB approved Untung Suropati Rp18.492.600",
                sourceItems.length,
                sourceTotal,
            ]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    const { GoogleProvider } = await import("../common/google");
    const rabModule = await import("../modules/rab/rab.service");
    await GoogleProvider.initialize();
    const links = await rabModule.rabService.regeneratePdf(String(target.rab_id));

    const verification = await pool.query(
        `
        SELECT
            r.id AS rab_id,
            r.status,
            r.grand_total,
            r.grand_total_final,
            COUNT(ri.id)::int AS item_count,
            COALESCE(SUM(ri.total_harga), 0)::int AS item_total,
            r.link_pdf_gabungan,
            r.link_pdf_non_sbo,
            r.link_pdf_rekapitulasi,
            r.link_pdf_sph
        FROM rab r
        LEFT JOIN rab_item ri ON ri.id_rab = r.id
        WHERE r.id = $1
        GROUP BY r.id
        `,
        [target.rab_id]
    );

    console.log(JSON.stringify({ links, verification: verification.rows[0] }, null, 2));
    await pool.end();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
