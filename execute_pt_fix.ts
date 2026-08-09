import { pool } from "./src/db/pool";
import { rabService } from "./src/modules/rab/rab.service";

async function run() {
    try {
        console.log("Starting data patch...");
        
        // 1. RAB Fixes
        const brokenRABs = await pool.query(`
            SELECT id, email_pembuat 
            FROM rab 
            WHERE nama_pt = 'NAMA PT TIDAK DITEMUKAN'
        `);
        for (const row of brokenRABs.rows) {
            let targetPT = 'CV GARUDA MAS PERMATA'; // Default for garudamaspermata
            if (row.email_pembuat === 'banglapis00@gmail.com') {
                targetPT = 'BERKAH JAYA ABADI,CV';
            }
            await pool.query(`UPDATE rab SET nama_pt = $1 WHERE id = $2`, [targetPT, row.id]);
            console.log(`Updated RAB ${row.id} to ${targetPT}`);
            
            // Regenerate PDF
            try {
                await rabService.regeneratePdf(String(row.id));
                console.log(`Regenerated PDF for RAB ${row.id}`);
            } catch (err) {
                console.error(`Failed to regenerate PDF for RAB ${row.id}:`, err);
            }
        }

        // 2. Toko Fixes
        const brokenTokos = await pool.query(`
            SELECT id, nama_kontraktor 
            FROM toko 
            WHERE nama_kontraktor = 'NAMA PT TIDAK DITEMUKAN'
        `);
        for (const row of brokenTokos.rows) {
            // Find email pembuat from related RAB
            const relatedRAB = await pool.query(`
                SELECT email_pembuat FROM rab WHERE id_toko = $1 LIMIT 1
            `, [row.id]);
            
            let email = 'garudamaspermata@gmail.com';
            if (relatedRAB.rows.length > 0) {
                email = relatedRAB.rows[0].email_pembuat;
            }

            let targetPT = 'CV GARUDA MAS PERMATA'; // Default for garudamaspermata
            if (email === 'banglapis00@gmail.com') {
                targetPT = 'BERKAH JAYA ABADI,CV';
            }
            
            await pool.query(`UPDATE toko SET nama_kontraktor = $1 WHERE id = $2`, [targetPT, row.id]);
            console.log(`Updated Toko ${row.id} to ${targetPT}`);
        }
        
        console.log("Data patching completed successfully.");
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
