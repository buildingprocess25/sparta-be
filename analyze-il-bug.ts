import { pool } from './src/db/pool';

async function analyzeAllCases() {
    const client = await pool.connect();
    try {
        const query = 
            SELECT 
                t.nomor_ulok, 
                t.lingkup_pekerjaan, 
                g.id AS gantt_id, 
                g.status AS gantt_status,
                kpg.id AS kpg_id, 
                kpg.kategori_pekerjaan
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN kategori_pekerjaan_gantt kpg ON kpg.id_gantt = g.id
            LEFT JOIN day_gantt_chart dgc ON dgc.kategori_pekerjaan_gantt_id = kpg.id
            WHERE kpg.kategori_pekerjaan ILIKE '%[IL]%'
              AND dgc.id IS NULL
            ORDER BY t.nomor_ulok, t.lingkup_pekerjaan;
        ;
        
        const res = await client.query(query);
        
        if (res.rows.length === 0) {
            console.log('Tidak ada kasus lain yang ditemukan!');
            return;
        }

        console.log(Ditemukan  kategori IL tanpa jadwal (bar biru) pada beberapa ULOK.\n);
        
        // Group by ULOK
        const grouped = res.rows.reduce((acc, row) => {
            if (!acc[row.nomor_ulok]) acc[row.nomor_ulok] = [];
            acc[row.nomor_ulok].push(row);
            return acc;
        }, {});

        console.log('=== DAFTAR ULOK YANG TERDAMPAK ===');
        for (const ulok of Object.keys(grouped)) {
            console.log(\n📍 ULOK: );
            const items = grouped[ulok];
            items.forEach(item => {
                console.log(   - [] Gantt ID:  (Status: ));
                console.log(     Kategori: );
            });
        }
        
        console.log(\nTOTAL ULOK TERDAMPAK: );

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAllCases();
