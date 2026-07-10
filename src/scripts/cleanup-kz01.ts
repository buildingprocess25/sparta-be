import { pool, withTransaction } from "../db/pool";
import { SPK_APPROVED_STATUSES } from "../modules/spk/spk.constants";

async function run() {
    // Perhatian: nomor_ulok di DB menggunakan uppercase
    const nomorUlok = "KZ01-2604-0001";
    console.log(`Starting cleanup for ULOK: ${nomorUlok}`);

    try {
        const result = await pool.query(`
            SELECT 
                s.id_toko,
                s.lingkup_pekerjaan,
                s.status as spk_status, 
                g.id as gantt_id
            FROM pengajuan_spk s
            LEFT JOIN gantt_chart g ON g.id_toko = s.id_toko
            WHERE UPPER(s.nomor_ulok) = UPPER($1)
            ORDER BY s.lingkup_pekerjaan
        `, [nomorUlok]);

        console.log("Current state:", result.rows);

        const unapprovedScopes = result.rows.filter(row => !row.spk_status || !SPK_APPROVED_STATUSES.includes(row.spk_status));
        console.log("Unapproved scopes:", unapprovedScopes);

        if (unapprovedScopes.length === 0) {
            console.log("No unapproved scopes found. Nothing to clean up.");
            return;
        }

        await withTransaction(async (client) => {
            for (const scope of unapprovedScopes) {
                if (scope.gantt_id) {
                    console.log(`Cleaning up Gantt ID ${scope.gantt_id} for scope ${scope.lingkup_pekerjaan} (id_toko: ${scope.id_toko})...`);

                    // Remove serah_terima (menggunakan id_toko)
                    const stRes = await client.query(`DELETE FROM berkas_serah_terima WHERE id_toko = $1 RETURNING id`, [scope.id_toko]);
                    console.log(`  Deleted ${stRes.rowCount} berkas_serah_terima`);

                    // Remove opname_item (menggunakan id_toko)
                    const opItemRes = await client.query(`DELETE FROM opname_item WHERE id_toko = $1 RETURNING id`, [scope.id_toko]);
                    console.log(`  Deleted ${opItemRes.rowCount} opname_item`);

                    // Remove opname_final (menggunakan id_toko)
                    const opFinalRes = await client.query(`DELETE FROM opname_final WHERE id_toko = $1 RETURNING id`, [scope.id_toko]);
                    console.log(`  Deleted ${opFinalRes.rowCount} opname_final`);

                    // Remove pengawasan + pengawasan_gantt (menggunakan id_gantt)
                    const pengGanttRes = await client.query(`SELECT id FROM pengawasan_gantt WHERE id_gantt = $1`, [scope.gantt_id]);
                    for (const pg of pengGanttRes.rows) {
                        const pengRes = await client.query(`DELETE FROM pengawasan WHERE id_pengawasan_gantt = $1 RETURNING id`, [pg.id]);
                        console.log(`  Deleted ${pengRes.rowCount} pengawasan for pengawasan_gantt ${pg.id}`);
                    }
                    const pgDel = await client.query(`DELETE FROM pengawasan_gantt WHERE id_gantt = $1 RETURNING id`, [scope.gantt_id]);
                    console.log(`  Deleted ${pgDel.rowCount} pengawasan_gantt`);

                    // Reset gantt_chart kembali ke ACTIVE (unlock) agar bisa diisi kembali setelah SPK approve
                    const ganttRes = await client.query(`UPDATE gantt_chart SET status = 'aktif' WHERE id = $1 RETURNING id`, [scope.gantt_id]);
                    console.log(`  Reset gantt_chart ${scope.gantt_id} status to aktif: ${ganttRes.rowCount} row`);

                    console.log(`  Scope ${scope.lingkup_pekerjaan} cleanup done.`);
                }
            }
        });

        console.log("Cleanup completed successfully.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    } finally {
        process.exit(0);
    }
}

run();
