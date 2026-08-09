const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testLogic() {
    const ganttId = 1436;

    const ganttRes = await pool.query('SELECT * FROM gantt_chart WHERE id = $1', [ganttId]);
    const idToko = ganttRes.rows[0].id_toko;

    const ilItemsRes = await pool.query(`
        SELECT
            ili.*,
            il.tanggal_mulai AS il_tanggal_mulai,
            il.tanggal_selesai AS il_tanggal_selesai,
            il.created_at AS il_created_at
        FROM instruksi_lapangan_item ili
        JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
        WHERE il.id_toko = $1
          AND il.status IN ('Disetujui', 'Approved')
        ORDER BY il.created_at ASC, il.id ASC, ili.id ASC
    `, [idToko]);

    const instruksi_lapangan_items = ilItemsRes.rows;

    const mapInstruksiLapanganToWorkItems = (items = []) =>
        items.map((item) => ({
            id: -Number(item.id),
            id_rab: 0,
            source_type: 'IL',
            id_instruksi_lapangan_item: Number(item.id),
            kategori_pekerjaan: `[IL] ${String(item.kategori_pekerjaan || 'LAIN-LAIN').toUpperCase()}`,
            jenis_pekerjaan: item.jenis_pekerjaan || '-',
        }));

    const instruksiItems = mapInstruksiLapanganToWorkItems(instruksi_lapangan_items);
    console.log("Instruksi Items mapped:", instruksiItems.map(i => i.kategori_pekerjaan));

    const ganttCatRes = await pool.query('SELECT * FROM kategori_pekerjaan_gantt WHERE id_gantt = $1', [ganttId]);
    
    const task = ganttCatRes.rows.find(k => k.kategori_pekerjaan === '[IL] FIXTURE');
    if (!task) {
        console.log("Task [IL] FIXTURE not found in Gantt!");
        return;
    }
    console.log("Task in Gantt:", task.kategori_pekerjaan);

    const rabItems = [...instruksiItems];
    const catItems = rabItems.filter((item) => item.kategori_pekerjaan.toUpperCase() === task.kategori_pekerjaan.toUpperCase());
    
    console.log("catItems length:", catItems.length);
    console.log("catItems:", catItems.map(c => c.kategori_pekerjaan));

    pool.end();
}

testLogic();
