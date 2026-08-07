import { pool } from '../db/pool';
import { ganttRepository } from '../modules/gantt/gantt.repository';

async function main() {
    console.log("Starting cleanup and sync of Pertambahan SPK...");
    try {
        const ulokQuery = await pool.query(`
            SELECT DISTINCT t.nomor_ulok
            FROM pertambahan_spk p
            JOIN pengajuan_spk s ON s.id = p.id_spk
            JOIN toko t ON t.id = s.id_toko
            WHERE p.status_persetujuan IN ('Disetujui BM', 'Menunggu Persetujuan')
        `);

        const uloks = ulokQuery.rows.map(r => r.nomor_ulok);
        console.log(`Found ${uloks.length} ULOKs to check.`);

        let deletedCount = 0;
        let syncedCount = 0;

        for (const ulok of uloks) {
            const pertambahanQuery = await pool.query(`
                SELECT p.id, p.id_spk, p.tanggal_spk_akhir_setelah_perpanjangan, p.status_persetujuan, s.lingkup_pekerjaan
                FROM pertambahan_spk p
                JOIN pengajuan_spk s ON s.id = p.id_spk
                JOIN toko t ON t.id = s.id_toko
                WHERE t.nomor_ulok = $1 
                  AND p.status_persetujuan IN ('Disetujui BM', 'Menunggu Persetujuan')
            `, [ulok]);

            const records = pertambahanQuery.rows;
            if (records.length === 0) continue;

            // Group by id_spk
            const bySpkId: Record<string, typeof records> = {};
            for (const r of records) {
                if (!bySpkId[r.id_spk]) bySpkId[r.id_spk] = [];
                bySpkId[r.id_spk].push(r);
            }

            const idsToDelete: number[] = [];
            const keptRecords: typeof records = [];

            // Phase 1: Internal deduplication per SPK
            for (const spkId in bySpkId) {
                const group = bySpkId[spkId];
                if (group.length > 1) {
                    // Sort descending by date (so index 0 is the latest)
                    group.sort((a, b) => {
                        const dateA = new Date(a.tanggal_spk_akhir_setelah_perpanjangan).getTime();
                        const dateB = new Date(b.tanggal_spk_akhir_setelah_perpanjangan).getTime();
                        return dateB - dateA;
                    });

                    keptRecords.push(group[0]);
                    for (let i = 1; i < group.length; i++) {
                        idsToDelete.push(group[i].id);
                    }
                } else {
                    keptRecords.push(group[0]);
                }
            }

            if (idsToDelete.length > 0) {
                await pool.query(`DELETE FROM pertambahan_spk WHERE id = ANY($1)`, [idsToDelete]);
                deletedCount += idsToDelete.length;
                console.log(`[${ulok}] Deleted ${idsToDelete.length} internal duplicates.`);
            }

            // Phase 2: Sync dates across Sipil and ME
            if (keptRecords.length > 1) {
                let maxDateValue = 0;
                let maxDateString = "";

                for (const r of keptRecords) {
                    const timeValue = new Date(r.tanggal_spk_akhir_setelah_perpanjangan).getTime();
                    if (!isNaN(timeValue) && timeValue > maxDateValue) {
                        maxDateValue = timeValue;
                        maxDateString = r.tanggal_spk_akhir_setelah_perpanjangan;
                    }
                }

                let syncUpdated = false;
                if (maxDateString) {
                    for (const r of keptRecords) {
                        const timeValue = new Date(r.tanggal_spk_akhir_setelah_perpanjangan).getTime();
                        if (!isNaN(timeValue) && timeValue < maxDateValue) {
                            await pool.query(`
                                UPDATE pertambahan_spk 
                                SET tanggal_spk_akhir_setelah_perpanjangan = $1
                                WHERE id = $2
                            `, [maxDateString, r.id]);
                            syncUpdated = true;
                            syncedCount++;
                            console.log(`[${ulok}] Synced SPK ID ${r.id_spk} (${r.lingkup_pekerjaan}) to date ${maxDateString}`);
                        }
                    }
                }

                // Phase 3: Sync Gantt if anything was modified
                if (idsToDelete.length > 0 || syncUpdated) {
                    try {
                        await ganttRepository.ensureLastPengawasanMatchesEffectiveSpkEnd(ulok);
                        console.log(`[${ulok}] Resynced Gantt Pengawasan.`);
                    } catch (e) {
                        console.error(`[${ulok}] Error syncing gantt:`, e);
                    }
                }
            } else if (idsToDelete.length > 0) {
                 try {
                    await ganttRepository.ensureLastPengawasanMatchesEffectiveSpkEnd(ulok);
                    console.log(`[${ulok}] Resynced Gantt Pengawasan.`);
                } catch (e) {
                    console.error(`[${ulok}] Error syncing gantt:`, e);
                }
            }
        }

        console.log(`\n--- SUMMARY ---`);
        console.log(`Total internal duplicates deleted: ${deletedCount}`);
        console.log(`Total cross-lingkup dates synced: ${syncedCount}`);
        console.log(`Cleanup complete!`);
        
    } catch (err) {
        console.error("Error during cleanup:", err);
    } finally {
        await pool.end();
    }
}
main();
