import { pool } from './src/db/pool';
import { opnameFinalRepository } from './src/modules/opname-final/opname-final.repository';

async function checkAll() {
    try {
        const res = await pool.query(`
            SELECT ofn.id, t.nomor_ulok, ofn.grand_total_opname, ofn.grand_total_final, ofn.status_opname_final
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            ORDER BY ofn.id ASC
        `);

        let fixedCount = 0;
        let issues = [];

        console.log(`Checking ${res.rows.length} opname_final records...`);

        for (const row of res.rows) {
            // Kita jalankan updateTotals
            await opnameFinalRepository.updateTotals(row.id);

            // Fetch ulang untuk melihat apakah nilainya berubah
            const after = await pool.query(`SELECT grand_total_opname, grand_total_final FROM opname_final WHERE id = $1`, [row.id]);
            const newRow = after.rows[0];

            if (
                String(row.grand_total_final) !== String(newRow.grand_total_final) ||
                String(row.grand_total_opname) !== String(newRow.grand_total_opname)
            ) {
                fixedCount++;
                issues.push({
                    id: row.id,
                    ulok: row.nomor_ulok,
                    status: row.status_opname_final,
                    old_opname: row.grand_total_opname,
                    new_opname: newRow.grand_total_opname,
                    old_final: row.grand_total_final,
                    new_final: newRow.grand_total_final
                });
            }
        }

        console.log(`\nFound and fixed ${fixedCount} records with incorrect totals:`);
        if (issues.length > 0) {
            console.table(issues);
        } else {
            console.log("No issues found! All other records are perfectly synced.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkAll();
