import { pool } from "./src/db/pool";

async function run() {
    try {
        const queries = [
            `SELECT setval('rab_id_seq', (SELECT MAX(id) FROM rab));`,
            `SELECT setval('rab_item_id_seq', (SELECT MAX(id) FROM rab_item));`,
            `SELECT setval('toko_id_seq', (SELECT MAX(id) FROM toko));`,
            `SELECT setval('gantt_chart_id_seq', (SELECT MAX(id) FROM gantt_chart));`,
            `SELECT setval('kategori_pekerjaan_gantt_id_seq', (SELECT MAX(id) FROM kategori_pekerjaan_gantt));`,
            `SELECT setval('day_gantt_chart_id_seq', (SELECT MAX(id) FROM day_gantt_chart));`,
            `SELECT setval('pengawasan_gantt_id_seq', (SELECT MAX(id) FROM pengawasan_gantt));`,
            `SELECT setval('pengawasan_id_seq', (SELECT MAX(id) FROM pengawasan));`,
            `SELECT setval('berkas_pengawasan_id_seq', (SELECT MAX(id) FROM berkas_pengawasan));`,
            `SELECT setval('opname_final_id_seq', (SELECT MAX(id) FROM opname_final));`,
            `SELECT setval('opname_item_id_seq', (SELECT MAX(id) FROM opname_item));`,
            `SELECT setval('pengajuan_spk_id_seq', (SELECT MAX(id) FROM pengajuan_spk));`,
            `SELECT setval('spk_approval_log_id_seq', (SELECT MAX(id) FROM spk_approval_log));`
        ];

        for (const q of queries) {
            try {
                const res = await pool.query(q);
                console.log(q, res.rows[0]);
            } catch (e) {
                // ignore
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
