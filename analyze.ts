import { pool } from './src/db/pool';

async function analyzeAllCases() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT DISTINCT
                t.nomor_ulok, 
                t.lingkup_pekerjaan, 
                g.id AS gantt_id, 
                g.status AS gantt_status,
                UPPER(TRIM(ili.kategori_pekerjaan)) AS kategori_missing
            FROM instruksi_lapangan_item ili
            JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
            JOIN toko t ON t.id = il.id_toko
            JOIN gantt_chart g ON g.id_toko = t.id
            WHERE UPPER(TRIM(COALESCE(ili.kategori_pekerjaan, ''))) NOT IN (
                SELECT UPPER(TRIM(kpg.kategori_pekerjaan)) 
                FROM kategori_pekerjaan_gantt kpg 
                WHERE kpg.id_gantt = g.id
            )
            ORDER BY t.nomor_ulok, t.lingkup_pekerjaan;
        `;
        
        const res = await client.query(query);
        
        if (res.rows.length === 0) {
            console.log('\n✅ Tidak ada kasus lain yang ditemukan! Semua kategori IL sudah masuk ke Gantt Chart.');
            return;
        }

        console.log(`\n🔍 Ditemukan ${res.rows.length} kategori IL yang GAGAL masuk ke tabel kategori_pekerjaan_gantt (sehingga tidak punya balok).\n`);
        
        const grouped = res.rows.reduce((acc: any, row: any) => {
            const key = `${row.nomor_ulok} [${row.lingkup_pekerjaan}] (Gantt ID: ${row.gantt_id} | Status: ${row.gantt_status})`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(row.kategori_missing);
            return acc;
        }, {});

        console.log('=== DAFTAR ULOK YANG TERDAMPAK ===');
        for (const ulok of Object.keys(grouped)) {
            console.log(`\n📍 ${ulok}`);
            const items = grouped[ulok];
            items.forEach((kategori: string) => {
                console.log(`     - [IL] ${kategori}`);
            });
        }
        
        console.log(`\nTOTAL ULOK TERDAMPAK: ${Object.keys(grouped).length}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAllCases().catch(console.error);
