import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import { withTransaction } from "../db/pool";

const inputPath = path.resolve(process.cwd(), "sql/reports/serah-terima-cleanup-recommended.csv");

const normalizeKey = (value: string) => value.trim().toLowerCase();

const loadIds = () => {
    const workbook = xlsx.readFile(inputPath, { raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    return rows.map((row) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) normalized[normalizeKey(key)] = value;
        return Number(normalized.berkas_serah_terima_id);
    }).filter((id) => Number.isInteger(id) && id > 0);
};

const main = async () => {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File cleanup tidak ditemukan: ${inputPath}`);
    }

    const ids = Array.from(new Set(loadIds()));
    if (ids.length === 0) throw new Error("Tidak ada berkas_serah_terima_id untuk cleanup");

    console.log(`Cleanup ST prematur untuk ${ids.length} berkas: ${ids.join(", ")}`);

    await withTransaction(async (client) => {
        await client.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_premature_cleanup_audit_v2 (
                audit_id SERIAL PRIMARY KEY,
                berkas_serah_terima_id INT NOT NULL,
                id_toko INT NOT NULL,
                nomor_ulok TEXT,
                nama_toko TEXT,
                cabang TEXT,
                lingkup_pekerjaan TEXT,
                link_pdf TEXT,
                st_created_at TIMESTAMP,
                opname_final_id INT,
                old_hari_denda INT,
                old_nilai_denda NUMERIC,
                old_tanggal_akhir_spk_denda DATE,
                old_tanggal_serah_terima_denda DATE,
                cleanup_reason TEXT NOT NULL,
                cleanup_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        const targetResult = await client.query(
            `
            SELECT
                bst.id AS berkas_serah_terima_id,
                bst.id_toko,
                bst.link_pdf,
                bst.created_at AS st_created_at,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                ofn.id AS opname_final_id,
                ofn.hari_denda AS old_hari_denda,
                ofn.nilai_denda AS old_nilai_denda,
                ofn.tanggal_akhir_spk_denda AS old_tanggal_akhir_spk_denda,
                ofn.tanggal_serah_terima_denda AS old_tanggal_serah_terima_denda
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            LEFT JOIN LATERAL (
                SELECT *
                FROM opname_final
                WHERE id_toko = t.id
                ORDER BY id DESC
                LIMIT 1
            ) ofn ON true
            WHERE bst.id = ANY($1::int[])
            ORDER BY bst.id
            `,
            [ids]
        );

        const targets = targetResult.rows;
        if (targets.length !== ids.length) {
            const foundIds = new Set(targets.map((row) => Number(row.berkas_serah_terima_id)));
            const missingIds = ids.filter((id) => !foundIds.has(id));
            throw new Error(`Sebagian ST tidak ditemukan, cleanup dibatalkan. Missing ids: ${missingIds.join(", ")}`);
        }

        await client.query(
            `
            INSERT INTO serah_terima_premature_cleanup_audit_v2 (
                berkas_serah_terima_id,
                id_toko,
                nomor_ulok,
                nama_toko,
                cabang,
                lingkup_pekerjaan,
                link_pdf,
                st_created_at,
                opname_final_id,
                old_hari_denda,
                old_nilai_denda,
                old_tanggal_akhir_spk_denda,
                old_tanggal_serah_terima_denda,
                cleanup_reason
            )
            SELECT
                bst.id,
                bst.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                bst.link_pdf,
                bst.created_at,
                ofn.id,
                ofn.hari_denda,
                ofn.nilai_denda,
                ofn.tanggal_akhir_spk_denda,
                ofn.tanggal_serah_terima_denda,
                'Cleanup ST prematur/nyangkut dari bug auto-generate; dikecualikan LUWU migrasi lama 2VZ1-2603'
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            LEFT JOIN LATERAL (
                SELECT *
                FROM opname_final
                WHERE id_toko = t.id
                ORDER BY id DESC
                LIMIT 1
            ) ofn ON true
            WHERE bst.id = ANY($1::int[])
            `,
            [ids]
        );

        const affectedOpnameIds = targets
            .map((row) => Number(row.opname_final_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (affectedOpnameIds.length > 0) {
            await client.query(
                `
                UPDATE opname_final
                SET hari_denda = 0,
                    nilai_denda = 0,
                    tanggal_akhir_spk_denda = NULL,
                    tanggal_serah_terima_denda = NULL
                WHERE id = ANY($1::int[])
                `,
                [affectedOpnameIds]
            );
        }

        await client.query(
            `
            DELETE FROM serah_terima_migration_backfill_audit
            WHERE old_berkas_serah_terima_id = ANY($1::int[])
            `,
            [ids]
        );

        await client.query(
            `
            DELETE FROM berkas_serah_terima
            WHERE id = ANY($1::int[])
            `,
            [ids]
        );

        console.table(targets.map((row) => ({
            berkas_serah_terima_id: row.berkas_serah_terima_id,
            nomor_ulok: row.nomor_ulok,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            lingkup: row.lingkup_pekerjaan,
            opname_final_id: row.opname_final_id,
        })));
    });

    console.log("Cleanup selesai. Backup tersimpan di serah_terima_premature_cleanup_audit_v2.");
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
