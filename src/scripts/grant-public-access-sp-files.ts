/**
 * Script to grant public "anyone with link" permission to all existing SP lampiran files
 * Run this once to fix existing files that don't have public permission
 * 
 * Usage: tsx src/scripts/grant-public-access-sp-files.ts
 */

import { pool } from "../common/db";
import { GoogleProvider } from "../common/google";

interface SpFile {
    id: number;
    lampiran_1_url: string | null;
    lampiran_2_url: string | null;
    link_pdf: string | null;
}

function extractFileId(url: string | null): string | null {
    if (!url) return null;
    
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
    const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    const viewMatch = url.match(/id=([^&]+)/);
    
    return driveFileMatch?.[1] ?? driveOpenMatch?.[1] ?? viewMatch?.[1] ?? null;
}

async function grantPublicPermission(fileId: string, drive: any): Promise<boolean> {
    try {
        await drive.permissions.create({
            fileId,
            requestBody: { type: "anyone", role: "reader" },
            fields: "id",
            supportsAllDrives: true,
        });
        return true;
    } catch (err: any) {
        console.error(`  ❌ Failed for ${fileId}:`, err?.message || err);
        return false;
    }
}

async function main() {
    console.log("🔧 Starting SP Files Public Permission Grant...\n");

    // Initialize Google Provider
    await GoogleProvider.initialize();
    const gp = GoogleProvider.instance;
    
    if (!gp.spartaDrive) {
        console.error("❌ Sparta Drive not configured!");
        process.exit(1);
    }

    // Get all SP actions with files
    const result = await pool.query<SpFile>(`
        SELECT 
            id,
            lampiran_1_url,
            lampiran_2_url,
            link_pdf
        FROM denda_actions
        WHERE action_type = 'SP'
        AND (
            lampiran_1_url IS NOT NULL 
            OR lampiran_2_url IS NOT NULL 
            OR link_pdf IS NOT NULL
        )
        ORDER BY id
    `);

    const files = result.rows;
    console.log(`📁 Found ${files.length} SP records with files\n`);

    let totalFiles = 0;
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const file of files) {
        console.log(`\n📄 Processing SP #${file.id}:`);

        const urls = [
            { label: "Lampiran 1", url: file.lampiran_1_url },
            { label: "Lampiran 2", url: file.lampiran_2_url },
            { label: "PDF SP", url: file.link_pdf },
        ];

        for (const { label, url } of urls) {
            if (!url) continue;
            
            totalFiles++;
            const fileId = extractFileId(url);
            
            if (!fileId) {
                console.log(`  ⚠️  ${label}: Invalid URL format, skipping`);
                skippedCount++;
                continue;
            }

            console.log(`  🔄 ${label}: Granting permission to ${fileId}...`);
            const success = await grantPublicPermission(fileId, gp.spartaDrive);
            
            if (success) {
                console.log(`  ✅ ${label}: Permission granted`);
                successCount++;
            } else {
                failCount++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Total SP records: ${files.length}`);
    console.log(`Total files found: ${totalFiles}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log("=".repeat(60));
    
    await pool.end();
    console.log("\n✨ Done!");
}

main().catch(err => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
