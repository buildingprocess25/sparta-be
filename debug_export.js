// Debug: investigasi kenapa file export kosong
const { Client } = require("pg");
require("dotenv").config({ path: "./sparta-be.env" });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
    await client.connect();

    // 1. Cek tipe data kolom id di tabel toko
    const tokoIdType = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'toko' AND column_name = 'id'
    `);
    console.log("toko.id type:", tokoIdType.rows[0]);

    // 2. Cek sample toko dengan semua field penting
    const sample = await client.query(`
        SELECT t.id, t.nama_toko, t.cabang, 
               t.nomor_ulok, t.kode_toko, t.lingkup_pekerjaan,
               COUNT(DISTINCT r.id) as rab_count
        FROM toko t
        LEFT JOIN rab r ON r.id_toko = t.id
        WHERE t.cabang NOT ILIKE '%HEAD OFFICE%'
        GROUP BY t.id, t.nama_toko, t.cabang, t.nomor_ulok, t.kode_toko, t.lingkup_pekerjaan
        HAVING COUNT(DISTINCT r.id) > 0
        LIMIT 5
    `);
    console.log("\nSample toko dengan RAB:");
    sample.rows.forEach(r => console.log(`  toko.id=${r.id} (type=${typeof r.id}) | ${r.nama_toko} | rab=${r.rab_count}`));

    // 3. Ambil ID sample dan cek apakah tipe cocok 
    const sampleId = sample.rows[0]?.id;
    console.log("\nSample ID dari DB:", sampleId, "type:", typeof sampleId);

    // 4. Cek RAB dates (period filter) untuk ID ini
    const rabDates = await client.query(`
        SELECT r.id_toko, r.created_at, EXTRACT(YEAR FROM r.created_at) as year
        FROM rab r WHERE r.id_toko = $1
    `, [sampleId]);
    console.log("\nRAB dates untuk toko", sampleId);
    rabDates.rows.forEach(r => console.log(`  created_at=${r.created_at} | year=${r.year}`));

    // 5. Cek SPK (pengajuan_spk) dates  
    const spkDates = await client.query(`
        SELECT ps.id_toko, ps.created_at, EXTRACT(YEAR FROM ps.created_at) as year
        FROM pengajuan_spk ps WHERE ps.id_toko = $1
    `, [sampleId]);
    console.log("\nSPK dates untuk toko", sampleId);
    spkDates.rows.forEach(r => console.log(`  created_at=${r.created_at} | year=${r.year}`));

    // 6. Cek tipe kolom id_toko di rab
    const rabIdType = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'rab' AND column_name IN ('id_toko', 'created_at')
        ORDER BY column_name
    `);
    console.log("\nrab kolom penting:", rabIdType.rows);

    // 7. Berapa banyak toko yang punya data tahun 2026
    const year2026 = await client.query(`
        SELECT COUNT(DISTINCT r.id_toko) as toko_ada_rab_2026
        FROM rab r
        WHERE EXTRACT(YEAR FROM r.created_at) = 2026
    `);
    console.log("\nToko dengan RAB tahun 2026:", year2026.rows[0].toko_ada_rab_2026);

    await client.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
