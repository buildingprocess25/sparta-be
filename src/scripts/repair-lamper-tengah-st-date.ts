import dotenv from "dotenv";

dotenv.config({ path: "../sparta-be.env" });

const TARGET_ULOK = "HZ01-2604-H070-R";
const TARGET_NAME = "LAMPER TENGAH SMG";
const TARGET_CREATED_AT = "2026-06-05 18:06:00+07";

async function main() {
    const commit = process.argv.includes("--commit");
    const { pool } = await import("../db/pool");
    const { GoogleProvider } = await import("../common/google");
    const { serahTerimaService } = await import("../modules/serah-terima/serah-terima.service");

    const candidates = await pool.query<{
        id_toko: number;
        nomor_ulok: string;
        nama_toko: string | null;
        lingkup_pekerjaan: string | null;
        berkas_id: number | null;
        created_at: string | null;
        link_pdf: string | null;
        opname_final_id: number | null;
        status_opname_final: string | null;
        tanggal_akhir_spk_denda: string | null;
        tanggal_serah_terima_denda: string | null;
    }>(
        `
        SELECT
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            bst.id AS berkas_id,
            bst.created_at,
            bst.link_pdf,
            ofn.id AS opname_final_id,
            ofn.status_opname_final,
            ofn.tanggal_akhir_spk_denda,
            ofn.tanggal_serah_terima_denda
        FROM toko t
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN LATERAL (
            SELECT id, status_opname_final, tanggal_akhir_spk_denda, tanggal_serah_terima_denda, created_at
            FROM opname_final
            WHERE id_toko = t.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) ofn ON true
        WHERE UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM($1))
          AND UPPER(TRIM(COALESCE(t.nama_toko, ''))) = UPPER(TRIM($2))
        ORDER BY t.id, bst.id
        `,
        [TARGET_ULOK, TARGET_NAME]
    );

    console.log(JSON.stringify({
        mode: commit ? "commit" : "preview",
        target_ulok: TARGET_ULOK,
        target_name: TARGET_NAME,
        target_created_at: TARGET_CREATED_AT,
        candidates: candidates.rows,
    }, null, 2));

    const berkasIds = candidates.rows
        .map((row) => row.berkas_id)
        .filter((id): id is number => typeof id === "number");

    if (!commit) {
        await pool.end();
        return;
    }

    if (berkasIds.length === 0) {
        throw new Error(`Tidak ada berkas_serah_terima untuk ${TARGET_ULOK} ${TARGET_NAME}`);
    }

    await pool.query("BEGIN");
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_date_repair_audit (
                berkas_serah_terima_id INT PRIMARY KEY,
                id_toko INT NOT NULL,
                nomor_ulok TEXT NOT NULL,
                nama_toko TEXT,
                old_created_at TIMESTAMPTZ,
                new_created_at TIMESTAMPTZ NOT NULL,
                reason TEXT NOT NULL,
                repaired_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        await pool.query(
            `
            INSERT INTO serah_terima_date_repair_audit (
                berkas_serah_terima_id,
                id_toko,
                nomor_ulok,
                nama_toko,
                old_created_at,
                new_created_at,
                reason
            )
            SELECT
                bst.id,
                t.id,
                t.nomor_ulok,
                t.nama_toko,
                bst.created_at,
                $3::timestamptz,
                'Koreksi tanggal ST Lamper Tengah berdasarkan bukti checklist 05/06/2026'
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            WHERE bst.id = ANY($1::int[])
              AND UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM($2))
            ON CONFLICT (berkas_serah_terima_id) DO NOTHING
            `,
            [berkasIds, TARGET_ULOK, TARGET_CREATED_AT]
        );

        await pool.query(
            `
            UPDATE berkas_serah_terima
            SET created_at = $2::timestamptz
            WHERE id = ANY($1::int[])
            `,
            [berkasIds, TARGET_CREATED_AT]
        );

        await pool.query("COMMIT");
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
    }

    await GoogleProvider.initialize();
    const regenerated = [];
    for (const berkasId of berkasIds) {
        regenerated.push(await serahTerimaService.regeneratePdfByBerkasId(berkasId));
    }

    const verification = await pool.query(
        `
        SELECT
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            bst.id AS berkas_id,
            bst.created_at,
            bst.link_pdf,
            ofn.id AS opname_final_id,
            ofn.tanggal_akhir_spk_denda,
            ofn.tanggal_serah_terima_denda
        FROM toko t
        JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN LATERAL (
            SELECT id, tanggal_akhir_spk_denda, tanggal_serah_terima_denda
            FROM opname_final
            WHERE id_toko = t.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) ofn ON true
        WHERE bst.id = ANY($1::int[])
        ORDER BY t.id, bst.id
        `,
        [berkasIds]
    );

    console.log(JSON.stringify({ regenerated, verification: verification.rows }, null, 2));
    await pool.end();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
