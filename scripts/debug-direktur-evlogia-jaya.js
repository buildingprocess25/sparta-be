/**
 * Debug script untuk DIREKTUR KONTRAKTOR - CV EVLOGIA JAYA
 * Investigasi kenapa RAB dan OPNAME tidak muncul
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../sparta-be.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sparta',
    port: parseInt(process.env.DB_PORT || '3306', 10),
};

const normalizeCompanyName = (value) => {
    if (!value) return '';
    let normalized = String(value).trim().toUpperCase();
    
    // Remove common punctuation and spaces
    normalized = normalized.replace(/[,.\s]+/g, '');
    
    // Remove PT/CV prefix/suffix to handle both "CV NAME" and "NAME, CV" formats
    normalized = normalized.replace(/^(PT|CV)/g, '').replace(/(PT|CV)$/g, '');
    
    return normalized;
};

async function main() {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        console.log('\n=== DEBUGGING CV EVLOGIA JAYA DIREKTUR KONTRAKTOR ===\n');
        
        // 1. Check user data
        console.log('1. USER DATA - CV EVLOGIA JAYA');
        console.log('=' .repeat(80));
        
        const [users] = await conn.execute(`
            SELECT 
                id,
                email,
                nama,
                role,
                cabang,
                nama_pt,
                branch_group
            FROM user_cabang 
            WHERE nama_pt LIKE '%EVLOGIA%'
            ORDER BY email
        `);
        
        console.log(`\nFound ${users.length} users with EVLOGIA in nama_pt:\n`);
        users.forEach((u, idx) => {
            console.log(`[${idx + 1}] ${u.email}`);
            console.log(`    Nama: ${u.nama}`);
            console.log(`    Role: ${u.role}`);
            console.log(`    Cabang: ${u.cabang}`);
            console.log(`    Nama PT (raw): "${u.nama_pt}"`);
            console.log(`    Nama PT (normalized): "${normalizeCompanyName(u.nama_pt)}"`);
            console.log(`    Branch Group: ${u.branch_group}`);
            console.log('');
        });
        
        // 2. Check RAB data
        console.log('\n2. RAB DATA - EVLOGIA JAYA');
        console.log('=' .repeat(80));
        
        const [rabs] = await conn.execute(`
            SELECT 
                r.id,
                r.nama_toko,
                r.cabang,
                r.lingkup_pekerjaan,
                r.status,
                t.nama_kontraktor,
                t.kode_toko
            FROM rabs r
            LEFT JOIN toko t ON r.kode_toko = t.kode_toko
            WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
            ORDER BY r.created_at DESC
            LIMIT 20
        `);
        
        console.log(`\nFound ${rabs.length} RAB records with EVLOGIA:\n`);
        rabs.forEach((r, idx) => {
            console.log(`[${idx + 1}] RAB ID: ${r.id}`);
            console.log(`    Toko: ${r.nama_toko}`);
            console.log(`    Cabang: ${r.cabang}`);
            console.log(`    Lingkup: ${r.lingkup_pekerjaan}`);
            console.log(`    Status: ${r.status}`);
            console.log(`    Kontraktor (raw): "${r.nama_kontraktor}"`);
            console.log(`    Kontraktor (normalized): "${normalizeCompanyName(r.nama_kontraktor)}"`);
            console.log('');
        });
        
        // 3. Check OPNAME data
        console.log('\n3. OPNAME DATA - EVLOGIA JAYA');
        console.log('=' .repeat(80));
        
        const [opnames] = await conn.execute(`
            SELECT 
                o.id,
                o.nomor_ulok,
                o.cabang,
                o.status_opname_final,
                o.nama_kontraktor,
                t.nama_kontraktor as toko_kontraktor
            FROM opname_final o
            LEFT JOIN toko t ON o.id_toko = t.id
            WHERE o.nama_kontraktor LIKE '%EVLOGIA%' 
               OR t.nama_kontraktor LIKE '%EVLOGIA%'
            ORDER BY o.created_at DESC
            LIMIT 20
        `);
        
        console.log(`\nFound ${opnames.length} OPNAME records with EVLOGIA:\n`);
        opnames.forEach((o, idx) => {
            console.log(`[${idx + 1}] ULOK: ${o.nomor_ulok}`);
            console.log(`    Cabang: ${o.cabang}`);
            console.log(`    Status: ${o.status_opname_final}`);
            console.log(`    Kontraktor opname_final (raw): "${o.nama_kontraktor}"`);
            console.log(`    Kontraktor opname_final (normalized): "${normalizeCompanyName(o.nama_kontraktor)}"`);
            console.log(`    Kontraktor toko (raw): "${o.toko_kontraktor}"`);
            console.log(`    Kontraktor toko (normalized): "${normalizeCompanyName(o.toko_kontraktor)}"`);
            console.log('');
        });
        
        // 4. Company name matching test
        console.log('\n4. COMPANY NAME MATCHING TEST');
        console.log('=' .repeat(80));
        
        const userCompanyVariations = [
            'CV EVLOGIA JAYA',
            'EVLOGIA JAYA, CV',
            'CV. EVLOGIA JAYA',
            'EVLOGIA JAYA CV',
        ];
        
        const normalizedUser = normalizeCompanyName('CV EVLOGIA JAYA');
        console.log(`\nUser company (normalized): "${normalizedUser}"\n`);
        
        userCompanyVariations.forEach(variation => {
            const normalized = normalizeCompanyName(variation);
            const matches = normalized === normalizedUser;
            console.log(`"${variation}"`);
            console.log(`  -> "${normalized}"`);
            console.log(`  -> MATCHES: ${matches ? '✅ YES' : '❌ NO'}`);
            console.log('');
        });
        
        // 5. Check pending status counts
        console.log('\n5. PENDING STATUS COUNTS');
        console.log('=' .repeat(80));
        
        const [rabCounts] = await conn.execute(`
            SELECT 
                r.status,
                COUNT(*) as count
            FROM rabs r
            LEFT JOIN toko t ON r.kode_toko = t.kode_toko
            WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
            GROUP BY r.status
            ORDER BY count DESC
        `);
        
        console.log('\nRAB Status Distribution for EVLOGIA:');
        rabCounts.forEach(rc => {
            console.log(`  ${rc.status}: ${rc.count}`);
        });
        
        const [opnameCounts] = await conn.execute(`
            SELECT 
                o.status_opname_final as status,
                COUNT(*) as count
            FROM opname_final o
            LEFT JOIN toko t ON o.id_toko = t.id
            WHERE o.nama_kontraktor LIKE '%EVLOGIA%' 
               OR t.nama_kontraktor LIKE '%EVLOGIA%'
            GROUP BY o.status_opname_final
            ORDER BY count DESC
        `);
        
        console.log('\nOPNAME Status Distribution for EVLOGIA:');
        opnameCounts.forEach(oc => {
            console.log(`  ${oc.status}: ${oc.count}`);
        });
        
        // 6. Check specific pending approvals
        console.log('\n6. SPECIFIC PENDING APPROVALS FOR DIREKTUR');
        console.log('=' .repeat(80));
        
        const [pendingRabs] = await conn.execute(`
            SELECT 
                r.id,
                r.nama_toko,
                r.cabang,
                r.status,
                t.nama_kontraktor
            FROM rabs r
            LEFT JOIN toko t ON r.kode_toko = t.kode_toko
            WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
              AND r.status LIKE '%Menunggu%Direktur%'
            ORDER BY r.created_at DESC
        `);
        
        console.log(`\nRAB pending Direktur approval: ${pendingRabs.length}`);
        pendingRabs.forEach(r => {
            console.log(`  - RAB ${r.id}: ${r.nama_toko} (${r.cabang}) - ${r.status}`);
        });
        
        const [pendingOpnames] = await conn.execute(`
            SELECT 
                o.id,
                o.nomor_ulok,
                o.cabang,
                o.status_opname_final,
                o.nama_kontraktor,
                t.nama_kontraktor as toko_kontraktor
            FROM opname_final o
            LEFT JOIN toko t ON o.id_toko = t.id
            WHERE (o.nama_kontraktor LIKE '%EVLOGIA%' OR t.nama_kontraktor LIKE '%EVLOGIA%')
              AND o.status_opname_final LIKE '%Menunggu%Direktur%'
            ORDER BY o.created_at DESC
        `);
        
        console.log(`\nOPNAME pending Direktur approval: ${pendingOpnames.length}`);
        pendingOpnames.forEach(o => {
            console.log(`  - ${o.nomor_ulok} (${o.cabang}) - ${o.status_opname_final}`);
            console.log(`    opname_final.nama_kontraktor: "${o.nama_kontraktor}"`);
            console.log(`    toko.nama_kontraktor: "${o.toko_kontraktor}"`);
        });
        
        // 7. Diagnosis
        console.log('\n7. DIAGNOSIS & RECOMMENDATIONS');
        console.log('=' .repeat(80));
        console.log('');
        
        if (users.length === 0) {
            console.log('❌ ISSUE: No users found with "EVLOGIA" in nama_pt');
            console.log('   Action: Check user_cabang table for correct nama_pt value');
        } else {
            console.log(`✅ Found ${users.length} user(s) with EVLOGIA`);
            users.forEach(u => {
                console.log(`   - ${u.email}: "${u.nama_pt}"`);
            });
        }
        
        console.log('');
        
        if (pendingRabs.length === 0 && pendingOpnames.length === 0) {
            console.log('⚠️  No pending approvals found for EVLOGIA JAYA');
            console.log('   This means either:');
            console.log('   1. All items have been approved already');
            console.log('   2. Items are stuck in earlier approval stages (Koordinator/Manager)');
            console.log('   3. Company name mismatch preventing visibility');
        } else {
            console.log(`✅ Found ${pendingRabs.length} RAB + ${pendingOpnames.length} OPNAME pending`);
            console.log('   These should be visible to DIREKTUR KONTRAKTOR');
        }
        
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify frontend logs show matching company names');
        console.log('2. Check if role in token matches "DIREKTUR KONTRAKTOR" or "DIREKTUR"');
        console.log('3. Verify cabang_array / branch filtering is not excluding items');
        console.log('4. Check browser console for [OPNAME Filter] Excluded logs');
        
    } finally {
        await conn.end();
    }
}

main().catch(console.error);
