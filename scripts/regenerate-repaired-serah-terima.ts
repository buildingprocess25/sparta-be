import "dotenv/config";
import { GoogleProvider } from "../src/common/google";
import { pool } from "../src/db/pool";
import { serahTerimaService } from "../src/modules/serah-terima/serah-terima.service";

type RepairedBerkasRow = {
    berkas_serah_terima_id: number;
    id_toko: number;
};

const main = async () => {
    await GoogleProvider.initialize();

    const result = await pool.query<RepairedBerkasRow>(
        `
        SELECT berkas_serah_terima_id, id_toko
        FROM berkas_serah_terima_created_at_repair_audit
        ORDER BY berkas_serah_terima_id ASC
        `
    );

    const failed: Array<{ id: number; message: string }> = [];

    for (const row of result.rows) {
        try {
            await serahTerimaService.regeneratePdfByBerkasId(row.berkas_serah_terima_id);
            console.log(`[ST REPAIR] Berhasil regenerate berkas id=${row.berkas_serah_terima_id}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failed.push({ id: row.berkas_serah_terima_id, message });
            console.error(`[ST REPAIR] Gagal regenerate berkas id=${row.berkas_serah_terima_id}: ${message}`);
        }
    }

    if (failed.length > 0) {
        throw new Error(`Regenerasi gagal untuk ${failed.length} berkas: ${JSON.stringify(failed)}`);
    }

    console.log(`[ST REPAIR] Selesai regenerate ${result.rows.length} berkas.`);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
