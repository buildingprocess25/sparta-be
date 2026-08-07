import { pool } from '../db/pool';

async function main() {
    try {
        const result = await pool.query(`
            SELECT 
                t.nomor_ulok,
                COUNT(p.id) as total_pertambahan,
                SUM(CASE WHEN s.lingkup_pekerjaan ILIKE '%sipil%' THEN 1 ELSE 0 END) as sipil_count,
                SUM(CASE WHEN s.lingkup_pekerjaan ILIKE '%me%' THEN 1 ELSE 0 END) as me_count
            FROM pertambahan_spk p
            JOIN pengajuan_spk s ON s.id = p.id_spk
            JOIN toko t ON t.id = s.id_toko
            WHERE p.status_persetujuan IN ('Disetujui BM', 'Menunggu Persetujuan')
            GROUP BY t.nomor_ulok
            HAVING COUNT(p.id) > 1
            ORDER BY COUNT(p.id) DESC, t.nomor_ulok
        `);
        
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
main();
