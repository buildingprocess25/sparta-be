import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

async function syncKodeToko() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const pool = new Pool({
        connectionString: DATABASE_URL,
        max: 1
    });

    try {
        console.log('🔌 Connecting to database...\n');
        
        // Read SQL file
        const sqlPath = path.join(__dirname, '..', 'sql', '2026-07-13-sync-kode-toko-across-lingkup.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        
        console.log('📄 Executing migration SQL...\n');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Execute the migration
        const result = await pool.query(sqlContent);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Migration script executed successfully!');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('📋 IMPORTANT NEXT STEPS:\n');
        console.log('1. Review the output above carefully');
        console.log('2. Check "4.2 Masalah yang masih tersisa" section');
        console.log('3. If everything looks good:');
        console.log('   → Run: COMMIT; in your SQL client');
        console.log('4. If there are issues:');
        console.log('   → Run: ROLLBACK; to undo changes');
        console.log('\n5. Backup table created: backup_toko_kode_sync_2026_07_13');
        console.log('   → You can restore anytime if needed\n');
        
    } catch (error: any) {
        console.error('❌ Error executing migration:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('🔌 Database connection closed\n');
    }
}

syncKodeToko();
