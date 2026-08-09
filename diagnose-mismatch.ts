import { pool } from './src/db/pool';

async function diagnose() {
    const client = await pool.connect();
    try {
        const ulok = '2SZ1-2601-0010';
        
        const tokoRes = await client.query(
            SELECT t.id, t.lingkup_pekerjaan, g.id as gantt_id
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            WHERE t.nomor_ulok = $1 AND t.lingkup_pekerjaan = 'SIPIL'
        , [ulok]);
        
        if (tokoRes.rows.length === 0) return console.log('Not found');
        const { id: toko_id, gantt_id } = tokoRes.rows[0];

        const expectedRes = await client.query(
            SELECT 'RAB' as source, UPPER(TRIM(ri.kategori_pekerjaan)) as kategori, UPPER(TRIM(ri.jenis_pekerjaan)) as jenis
            FROM rab_item ri
            JOIN rab r ON r.id = ri.id_rab
            WHERE r.id_toko = $1
              AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ''))) IN (
                  SELECT UPPER(TRIM(kpg.kategori_pekerjaan)) FROM kategori_pekerjaan_gantt kpg WHERE kpg.id_gantt = $2
              )
            UNION ALL
            SELECT 'IL' as source, UPPER(TRIM(ili.kategori_pekerjaan)) as kategori, UPPER(TRIM(ili.jenis_pekerjaan)) as jenis
            FROM instruksi_lapangan_item ili
            JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
            WHERE il.id_toko = $1
              AND UPPER(TRIM(COALESCE(ili.kategori_pekerjaan, ''))) IN (
                  SELECT UPPER(TRIM(kpg.kategori_pekerjaan)) FROM kategori_pekerjaan_gantt kpg WHERE kpg.id_gantt = $2
              )
        , [toko_id, gantt_id]);
        
        const selesaiRes = await client.query(
            SELECT DISTINCT ON (
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
            )
                UPPER(TRIM(REPLACE(COALESCE(p.kategori_pekerjaan, ''), '[IL] ', ''))) as kategori,
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) as jenis,
                p.status
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE p.id_gantt = $1
            ORDER BY
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                p.id DESC
        , [gantt_id]);

        console.log('EXPECTED ITEMS:', expectedRes.rows.length);
        console.log('SELESAI ITEMS (Latest Status):', selesaiRes.rows.filter(r => r.status.toLowerCase() === 'selesai').length);
        
        const expectedSet = new Set(expectedRes.rows.map(r => r.kategori + '|' + r.jenis));
        const selesaiSet = new Set(selesaiRes.rows.filter(r => r.status.toLowerCase() === 'selesai').map(r => r.kategori + '|' + r.jenis));
        
        console.log('\nITEMS EXPECTED BUT NOT SELESAI:');
        const missing = expectedRes.rows.filter(r => !selesaiSet.has(r.kategori + '|' + r.jenis));
        missing.slice(0, 15).forEach(m => console.log('- [' + m.source + '] ' + m.kategori + ' | ' + m.jenis));
        if (missing.length > 15) console.log('... and ' + (missing.length - 15) + ' more');

        const missingPengawasanRes = await client.query(
            SELECT COUNT(*)::int as missing FROM (
                SELECT DISTINCT ON (
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                ) p.status
                FROM pengawasan p
                LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                WHERE p.id_gantt = $1
                ORDER BY
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                    to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                    p.id DESC
            ) latest WHERE LOWER(status) != 'selesai'
        , [gantt_id]);

        console.log('\nMISSING PENGAWASAN CHECKPOINTS (BE Blocking rule):', missingPengawasanRes.rows[0].missing);

    } finally {
        client.release();
        await pool.end();
    }
}
diagnose().catch(console.error);
