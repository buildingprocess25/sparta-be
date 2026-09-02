import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const tokoId = 2753; // CZ01-2607-CD28-R
        console.log(`Starting Gantt Chart Sync for Toko ID: ${tokoId}`);

        // 1. Get latest approved RAB
        const rab = await pool.query(`
            SELECT id FROM rab WHERE id_toko = $1 ORDER BY id DESC LIMIT 1
        `, [tokoId]);
        
        if (rab.rows.length === 0) {
            console.log("No RAB found for this toko.");
            return;
        }
        const rabId = rab.rows[0].id;

        // 2. Get valid categories from RAB items
        const rabItems = await pool.query(`
            SELECT DISTINCT kategori_pekerjaan FROM rab_item WHERE id_rab = $1
        `, [rabId]);
        const validCategories = rabItems.rows.map(r => r.kategori_pekerjaan.trim().toUpperCase());
        console.log(`Valid RAB Categories (${validCategories.length}):`, validCategories);

        // 3. Get Gantt Chart ID
        const gantt = await pool.query(`
            SELECT id FROM gantt_chart WHERE id_toko = $1
        `, [tokoId]);

        if (gantt.rows.length === 0) {
            console.log("No Gantt Chart found for this toko.");
            return;
        }
        const ganttId = gantt.rows[0].id;

        // 4. Get Gantt Categories
        const ganttCategories = await pool.query(`
            SELECT id, kategori_pekerjaan FROM kategori_pekerjaan_gantt WHERE id_gantt = $1
        `, [ganttId]);

        const invalidCategories = ganttCategories.rows.filter(gc => {
            return !validCategories.includes(gc.kategori_pekerjaan.trim().toUpperCase());
        });

        console.log(`Found ${invalidCategories.length} orphaned Gantt categories out of ${ganttCategories.rows.length} total.`);
        
        if (invalidCategories.length === 0) {
            console.log("No orphaned categories to delete.");
            return;
        }

        const invalidCategoryIds = invalidCategories.map(c => c.id);
        console.log(`Categories to delete:`, invalidCategories.map(c => c.kategori_pekerjaan));

        // Let's delete them cleanly
        await pool.query('BEGIN');

        try {
            // Note: pengawasan_gantt doesn't have kategori_pekerjaan directly in the current DB schema. 
            // Let's just delete the day_gantt_chart, dependency_gantt, and kategori_pekerjaan_gantt

            
            // day_gantt_chart
            const deletedDays = await pool.query(`
                DELETE FROM day_gantt_chart WHERE id_kategori_pekerjaan_gantt = ANY($1::int[]) RETURNING id
            `, [invalidCategoryIds]);
            console.log(`Deleted ${deletedDays.rowCount} rows from day_gantt_chart.`);

            // dependency_gantt
            const deletedDeps = await pool.query(`
                DELETE FROM dependency_gantt WHERE id_kategori = ANY($1::int[]) OR id_kategori_terikat = ANY($1::int[]) RETURNING id
            `, [invalidCategoryIds]);
            console.log(`Deleted ${deletedDeps.rowCount} rows from dependency_gantt.`);

            // kategori_pekerjaan_gantt
            const deletedCats = await pool.query(`
                DELETE FROM kategori_pekerjaan_gantt WHERE id = ANY($1::int[]) RETURNING id
            `, [invalidCategoryIds]);
            console.log(`Deleted ${deletedCats.rowCount} rows from kategori_pekerjaan_gantt.`);

            await pool.query('COMMIT');
            console.log("Successfully fixed Gantt Chart!");
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
