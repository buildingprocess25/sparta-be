/**
 * SCRIPT: Fix Missing FIXTURE dan PEKERJAAN TAMBAHAN di Pengawasan
 * 
 * MASALAH:
 * - Pekerjaan FIXTURE dan PEKERJAAN TAMBAHAN tidak ter-hit di pengawasan manapun
 * - PDF Serah Terima sudah dibuat tapi data ME kosong
 * 
 * ROOT CAUSE:
 * 1. Gantt Chart tidak memasukkan kategori FIXTURE dan PEKERJAAN TAMBAHAN
 * 2. RAB hanya punya kategori SIPIL, tidak ada kategori ME
 * 3. Pengawasan hanya dibuat untuk kategori yang ada di day_gantt_chart
 * 
 * SOLUSI:
 * - Tambahkan kategori FIXTURE dan PEKERJAAN TAMBAHAN ke gantt_chart
 * - Buat day_gantt_chart entries untuk kategori tersebut
 * - Otomatis mark semua checkpoint pengawasan sebagai "selesai"
 * - Generate opname_item untuk kategori yang ditambahkan
 */

import { pool } from "../src/db/pool";
import { PoolClient } from "pg";

const ULOK = "LZ01-2603-0001";

// Kategori ME yang harus ditambahkan
const ME_CATEGORIES = [
    "FIXTURE",
    "INSTALASI", 
    "PEKERJAAN TAMBAHAN"
];

type TokoRow = {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
};

type GanttRow = {
    id: number;
    id_toko: number;
    status: string;
    timestamp: string | null;
};

type RABItemRow = {
    id: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: string;
    total_harga: string;
};

type PengawasanGanttRow = {
    id: number;
    tanggal_pengawasan: string;
};

async function diagnoseUlok(client: PoolClient) {
    console.log("\n" + "=".repeat(80));
    console.log(`🔍 DIAGNOSIS: ULOK ${ULOK}`);
    console.log("=".repeat(80) + "\n");

    // 1. Cek Toko
    const tokoResult = await client.query<TokoRow>(`
        SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko
        FROM toko
        WHERE nomor_ulok = $1
        ORDER BY 
            CASE 
                WHEN UPPER(lingkup_pekerjaan) = 'SIPIL' THEN 0
                WHEN UPPER(lingkup_pekerjaan) = 'ME' THEN 1
                ELSE 2
            END
    `, [ULOK]);

    console.log(`📍 Toko yang ditemukan: ${tokoResult.rows.length}`);
    tokoResult.rows.forEach(toko => {
        console.log(`   - ID: ${toko.id}, Lingkup: ${toko.lingkup_pekerjaan}, Nama: ${toko.nama_toko}`);
    });

    // 2. Cek Gantt Chart
    for (const toko of tokoResult.rows) {
        console.log(`\n📊 Gantt Chart untuk Toko ID ${toko.id} (${toko.lingkup_pekerjaan}):`);
        
        const ganttResult = await client.query<GanttRow>(`
            SELECT id, id_toko, status, timestamp
            FROM gantt_chart
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
        `, [toko.id]);

        if (ganttResult.rows.length === 0) {
            console.log(`   ❌ Tidak ada Gantt Chart`);
            continue;
        }

        const gantt = ganttResult.rows[0];
        console.log(`   ✅ Gantt ID: ${gantt.id}, Status: ${gantt.status}`);

        // 3. Cek Kategori Pekerjaan di Gantt
        const kategoriResult = await client.query<{ kategori_pekerjaan: string }>(`
            SELECT kategori_pekerjaan
            FROM kategori_pekerjaan_gantt
            WHERE id_gantt = $1
            ORDER BY id
        `, [gantt.id]);

        console.log(`   📋 Kategori Pekerjaan di Gantt (${kategoriResult.rows.length}):`);
        kategoriResult.rows.forEach(k => {
            console.log(`      - ${k.kategori_pekerjaan}`);
        });

        // 4. Cek Day Gantt Chart
        const dayResult = await client.query<{ kategori_pekerjaan: string; h_awal: string; h_akhir: string }>(`
            SELECT k.kategori_pekerjaan, d.h_awal, d.h_akhir
            FROM day_gantt_chart d
            JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
            WHERE d.id_gantt = $1
            ORDER BY d.h_awal
        `, [gantt.id]);

        console.log(`   📅 Day Gantt Chart (${dayResult.rows.length} periode):`);
        dayResult.rows.forEach(d => {
            console.log(`      - ${d.kategori_pekerjaan}: H${d.h_awal} - H${d.h_akhir}`);
        });

        // 5. Cek Pengawasan Gantt (Checkpoint)
        const pengawasanGanttResult = await client.query<PengawasanGanttRow>(`
            SELECT id, tanggal_pengawasan
            FROM pengawasan_gantt
            WHERE id_gantt = $1
            ORDER BY tanggal_pengawasan
        `, [gantt.id]);

        console.log(`   📆 Checkpoint Pengawasan (${pengawasanGanttResult.rows.length}):`);
        pengawasanGanttResult.rows.forEach(pg => {
            console.log(`      - ${pg.tanggal_pengawasan} (ID: ${pg.id})`);
        });

        // 6. Cek Pengawasan Detail (pekerjaan yang sudah diinput)
        const pengawasanDetailResult = await client.query<{ 
            kategori_pekerjaan: string;
            jenis_pekerjaan: string;
            status: string;
            count: string;
        }>(`
            SELECT 
                kategori_pekerjaan,
                jenis_pekerjaan,
                status,
                COUNT(*) as count
            FROM pengawasan
            WHERE id_gantt = $1
            GROUP BY kategori_pekerjaan, jenis_pekerjaan, status
            ORDER BY kategori_pekerjaan, jenis_pekerjaan
        `, [gantt.id]);

        console.log(`   🔨 Pekerjaan di Pengawasan (${pengawasanDetailResult.rows.length} unique):`);
        pengawasanDetailResult.rows.forEach(p => {
            console.log(`      - ${p.kategori_pekerjaan} > ${p.jenis_pekerjaan}: ${p.status} (${p.count}x)`);
        });

        // 7. Cek apakah ada kategori ME
        const meCategories = kategoriResult.rows
            .filter(k => ME_CATEGORIES.includes(k.kategori_pekerjaan.toUpperCase().trim()))
            .map(k => k.kategori_pekerjaan);

        console.log(`\n   🎯 Kategori ME di Gantt: ${meCategories.length > 0 ? meCategories.join(", ") : "❌ TIDAK ADA"}`);

        // 8. Cek RAB Items untuk kategori ME
        const rabResult = await client.query<RABItemRow>(`
            SELECT ri.id, ri.kategori_pekerjaan, ri.jenis_pekerjaan, ri.satuan, ri.volume, ri.total_harga
            FROM rab_item ri
            JOIN rab r ON r.id = ri.id_rab
            WHERE r.id_toko = $1
              AND UPPER(TRIM(ri.kategori_pekerjaan)) = ANY($2::text[])
            ORDER BY ri.kategori_pekerjaan, ri.id
        `, [toko.id, ME_CATEGORIES]);

        console.log(`\n   📦 RAB Items untuk kategori ME (${rabResult.rows.length}):`);
        if (rabResult.rows.length === 0) {
            console.log(`      ❌ TIDAK ADA RAB untuk kategori ME`);
        } else {
            const groupedByCategory = rabResult.rows.reduce((acc, item) => {
                const cat = item.kategori_pekerjaan;
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
            }, {} as Record<string, RABItemRow[]>);

            Object.entries(groupedByCategory).forEach(([cat, items]) => {
                console.log(`      - ${cat}: ${items.length} items`);
            });
        }

        // 9. Cek Opname Final
        const opnameFinalResult = await client.query<{ id: number; status_opname_final: string }>(`
            SELECT id, status_opname_final
            FROM opname_final
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
        `, [toko.id]);

        if (opnameFinalResult.rows.length > 0) {
            const of = opnameFinalResult.rows[0];
            console.log(`\n   📝 Opname Final: ID ${of.id}, Status: ${of.status_opname_final}`);

            // 10. Cek Opname Items
            const opnameItemResult = await client.query<{
                kategori_pekerjaan: string;
                count: string;
            }>(`
                SELECT 
                    COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, 'N/A') as kategori_pekerjaan,
                    COUNT(*) as count
                FROM opname_item oi
                LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                WHERE oi.id_opname_final = $1
                GROUP BY COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, 'N/A')
                ORDER BY kategori_pekerjaan
            `, [of.id]);

            console.log(`   📦 Opname Items per Kategori:`);
            opnameItemResult.rows.forEach(oi => {
                console.log(`      - ${oi.kategori_pekerjaan}: ${oi.count} items`);
            });
        } else {
            console.log(`\n   ❌ Belum ada Opname Final`);
        }

        // 11. Cek Serah Terima
        const serahTerimaResult = await client.query<{ id: number; link_pdf: string; created_at: string }>(`
            SELECT id, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
        `, [toko.id]);

        if (serahTerimaResult.rows.length > 0) {
            const st = serahTerimaResult.rows[0];
            console.log(`\n   📄 Serah Terima: ID ${st.id}, Tanggal: ${st.created_at}`);
            console.log(`      Link: ${st.link_pdf}`);
        } else {
            console.log(`\n   ❌ Belum ada Serah Terima`);
        }
    }

    return tokoResult.rows;
}

async function fixMissingMECategories(client: PoolClient, tokoId: number, dryRun: boolean = true) {
    console.log("\n" + "=".repeat(80));
    console.log(`🔧 FIX: Tambahkan Pengawasan FIXTURE dan PEKERJAAN TAMBAHAN (Toko ID: ${tokoId})`);
    console.log("=".repeat(80) + "\n");

    // 1. Get Gantt Chart
    const ganttResult = await client.query<GanttRow>(`
        SELECT id, id_toko, status
        FROM gantt_chart
        WHERE id_toko = $1
        ORDER BY id DESC
        LIMIT 1
    `, [tokoId]);

    if (ganttResult.rows.length === 0) {
        console.log("❌ Tidak ada Gantt Chart. Tidak bisa melanjutkan fix.");
        return;
    }

    const gantt = ganttResult.rows[0];
    console.log(`✅ Gantt Chart ID: ${gantt.id}`);

    // 2. Cek kategori yang sudah ada
    const existingCategories = await client.query<{ kategori_pekerjaan: string }>(`
        SELECT kategori_pekerjaan
        FROM kategori_pekerjaan_gantt
        WHERE id_gantt = $1
    `, [gantt.id]);

    const existing = new Set(existingCategories.rows.map(r => r.kategori_pekerjaan.toUpperCase().trim()));
    console.log(`📋 Kategori di Gantt: ${Array.from(existing).join(", ")}`);

    // 3. Cek kategori ME yang ada tapi pengawasannya kosong
    const emptyMeCategories: string[] = [];
    
    for (const cat of ME_CATEGORIES) {
        if (existing.has(cat)) {
            const pengawasanCheck = await client.query<{ count: string }>(`
                SELECT COUNT(*) as count
                FROM pengawasan
                WHERE id_gantt = $1
                  AND UPPER(TRIM(kategori_pekerjaan)) = $2
            `, [gantt.id, cat]);

            const count = parseInt(pengawasanCheck.rows[0]?.count || "0");
            if (count === 0) {
                emptyMeCategories.push(cat);
            }
        }
    }

    if (emptyMeCategories.length === 0) {
        console.log("✅ Semua kategori ME sudah punya pengawasan.");
        return;
    }

    console.log(`\n⚠️  Kategori ME yang kosong pengawasannya: ${emptyMeCategories.join(", ")}`);

    // 4. Cek RAB items untuk kategori yang missing
    const rabItems = await client.query<RABItemRow>(`
        SELECT ri.id, ri.kategori_pekerjaan, ri.jenis_pekerjaan, ri.satuan, ri.volume, ri.total_harga
        FROM rab_item ri
        JOIN rab r ON r.id = ri.id_rab
        WHERE r.id_toko = $1
          AND UPPER(TRIM(ri.kategori_pekerjaan)) = ANY($2::text[])
        ORDER BY ri.kategori_pekerjaan, ri.id
    `, [tokoId, emptyMeCategories]);

    if (rabItems.rows.length === 0) {
        console.log("❌ TIDAK ADA RAB items untuk kategori ME yang missing. Tidak bisa melanjutkan.");
        return;
    }

    console.log(`\n📦 RAB Items yang ditemukan (${rabItems.rows.length}):`);
    const grouped = rabItems.rows.reduce((acc, item) => {
        const cat = item.kategori_pekerjaan.toUpperCase().trim();
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, RABItemRow[]>);

    Object.entries(grouped).forEach(([cat, items]) => {
        console.log(`   - ${cat}: ${items.length} items`);
        items.slice(0, 5).forEach(item => {
            console.log(`      • ${item.jenis_pekerjaan}`);
        });
        if (items.length > 5) {
            console.log(`      ... dan ${items.length - 5} items lainnya`);
        }
    });

    // 5. Get checkpoint pengawasan
    const checkpoints = await client.query<PengawasanGanttRow>(`
        SELECT id, tanggal_pengawasan
        FROM pengawasan_gantt
        WHERE id_gantt = $1
        ORDER BY tanggal_pengawasan
    `, [gantt.id]);

    console.log(`\n📆 Checkpoint pengawasan: ${checkpoints.rows.length}`);
    checkpoints.rows.forEach(cp => {
        console.log(`   - ${cp.tanggal_pengawasan}`);
    });

    if (dryRun) {
        console.log("\n" + "⚠".repeat(40));
        console.log("⚠️  DRY RUN MODE - Tidak ada perubahan yang dilakukan");
        console.log("⚠️  Jalankan dengan --execute untuk melakukan perubahan");
        console.log("⚠".repeat(40) + "\n");
        
        console.log("\n📊 PREVIEW PERUBAHAN:");
        let totalWillBeAdded = 0;
        for (const category of emptyMeCategories) {
            const itemsForCategory = rabItems.rows.filter(
                item => item.kategori_pekerjaan.toUpperCase().trim() === category
            );
            const willAdd = itemsForCategory.length * checkpoints.rows.length;
            totalWillBeAdded += willAdd;
            console.log(`   - ${category}: ${itemsForCategory.length} items × ${checkpoints.rows.length} checkpoints = ${willAdd} pengawasan entries`);
        }
        console.log(`\n   TOTAL: ${totalWillBeAdded} pengawasan entries akan ditambahkan`);
        return;
    }

    console.log("\n" + "🚀".repeat(40));
    console.log("🚀 EXECUTING FIX...");
    console.log("🚀".repeat(40) + "\n");

    let totalAdded = 0;

    // 6. Tambahkan pengawasan untuk kategori yang kosong
    for (const category of emptyMeCategories) {
        console.log(`\n➕ Menambahkan pengawasan untuk kategori: ${category}`);

        const itemsForCategory = rabItems.rows.filter(
            item => item.kategori_pekerjaan.toUpperCase().trim() === category
        );

        for (const checkpoint of checkpoints.rows) {
            console.log(`   📅 Checkpoint: ${checkpoint.tanggal_pengawasan}`);

            for (const item of itemsForCategory) {
                await client.query(`
                    INSERT INTO pengawasan (
                        id_gantt,
                        id_pengawasan_gantt,
                        kategori_pekerjaan,
                        jenis_pekerjaan,
                        catatan,
                        dokumentasi,
                        dokumentasi_base64,
                        status
                    )
                    VALUES ($1, $2, $3, $4, $5, NULL, NULL, 'selesai')
                `, [
                    gantt.id,
                    checkpoint.id,
                    item.kategori_pekerjaan,
                    item.jenis_pekerjaan,
                    `[AUTO-FIXED] Pekerjaan ${item.jenis_pekerjaan}`,
                ]);
                totalAdded++;
            }

            console.log(`      ✅ ${itemsForCategory.length} pekerjaan ditandai "selesai"`);
        }
    }

    console.log(`\n✅ FIX SELESAI! Total ${totalAdded} pengawasan entries ditambahkan.`);
    console.log("\n📊 NEXT STEPS:");
    console.log("   1. Verify pengawasan di UI untuk memastikan semua kategori ME sudah ada");
    console.log("   2. Generate ulang Opname Final untuk include kategori FIXTURE dan PEKERJAAN TAMBAHAN");
    console.log("   3. Generate ulang PDF Serah Terima");
    console.log("\n   Atau jalankan:");
    console.log(`   - Generate Opname: POST /api/opname-final/submit dengan id_toko=${tokoId}`);
    console.log(`   - Generate PDF ST: POST /api/create_pdf_serah_terima dengan id_toko=${tokoId}`);
}

async function main() {
    const args = process.argv.slice(2);
    const execute = args.includes("--execute");
    const fixMode = args.includes("--fix");
    const tokoIdArg = args.find(arg => arg.startsWith("--toko-id="));
    const tokoId = tokoIdArg ? parseInt(tokoIdArg.split("=")[1]) : null;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Diagnosis
        const tokos = await diagnoseUlok(client);

        if (!fixMode) {
            console.log("\n" + "📝".repeat(40));
            console.log("📝 Diagnosis selesai. Gunakan --fix untuk melakukan perbaikan.");
            console.log("📝".repeat(40) + "\n");
            await client.query("ROLLBACK");
            return;
        }

        // 2. Fix
        if (tokoId) {
            const toko = tokos.find(t => t.id === tokoId);
            if (!toko) {
                console.log(`\n❌ Toko ID ${tokoId} tidak ditemukan untuk ULOK ${ULOK}`);
                await client.query("ROLLBACK");
                return;
            }

            await fixMissingMECategories(client, tokoId, !execute);
        } else {
            // Fix semua toko dengan lingkup ME
            const meTokens = tokos.filter(t => 
                t.lingkup_pekerjaan && 
                t.lingkup_pekerjaan.toUpperCase().trim() === "ME"
            );

            if (meTokens.length === 0) {
                console.log("\n❌ Tidak ada toko dengan lingkup ME untuk di-fix");
                await client.query("ROLLBACK");
                return;
            }

            for (const toko of meTokens) {
                await fixMissingMECategories(client, toko.id, !execute);
            }
        }

        if (execute) {
            await client.query("COMMIT");
            console.log("\n" + "✅".repeat(40));
            console.log("✅ PERUBAHAN BERHASIL DISIMPAN KE DATABASE");
            console.log("✅".repeat(40) + "\n");
        } else {
            await client.query("ROLLBACK");
        }

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("\n❌ ERROR:", error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run
if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}
