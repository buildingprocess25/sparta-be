import { pool } from '../db/pool';

async function main() {
    try {
        const result = await pool.query(`
            SELECT 
                t.nomor_ulok,
                COUNT(p.id) as total_pertambahan,
                json_agg(json_build_object(
                    'id', p.id,
                    'status', p.status_persetujuan,
                    'lingkup', s.lingkup_pekerjaan,
                    'tanggal_akhir', p.tanggal_spk_akhir_setelah_perpanjangan
                )) as details
            FROM pertambahan_spk p
            JOIN pengajuan_spk s ON s.id = p.id_spk
            JOIN toko t ON t.id = s.id_toko
            WHERE p.status_persetujuan IN ('Disetujui BM', 'Menunggu Persetujuan')
            GROUP BY t.nomor_ulok
            HAVING COUNT(p.id) > 1
            ORDER BY COUNT(p.id) DESC
        `);
        
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
main();
