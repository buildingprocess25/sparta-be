/**
 * Diagnostic script for TZ01-2511-0003
 * Run: npx tsx src/scripts/debug-tz01.ts
 */
import { pool } from "../db/pool";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../../sparta-be.env") });

async function main() {
    const nomorUlok = "TZ01-2511-0003";

    console.log(`\n=== TOKO ===`);
    const tokoRes = await pool.query(
        `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, cabang FROM toko WHERE nomor_ulok ILIKE $1 ORDER BY id`,
        [nomorUlok]
    );
    console.table(tokoRes.rows);
    const tokoIds = tokoRes.rows.map(r => r.id);

    console.log(`\n=== PENGAJUAN SPK (approved) ===`);
    const spkRes = await pool.query(
        `SELECT id, id_toko, nomor_ulok, lingkup_pekerjaan, waktu_selesai, status FROM pengajuan_spk
         WHERE id_toko = ANY($1::int[])
           AND UPPER(TRIM(COALESCE(status,''))) IN ('SPK_APPROVED','APPROVED','DISETUJUI','AKTIF','ACTIVE','SELESAI')
         ORDER BY id`,
        [tokoIds]
    );
    console.table(spkRes.rows);

    console.log(`\n=== PERTAMBAHAN SPK (approved) ===`);
    if (spkRes.rows.length > 0) {
        const spkIds = spkRes.rows.map(r => r.id);
        const ptRes = await pool.query(
            `SELECT id, id_spk, tanggal_spk_akhir_setelah_perpanjangan, status_persetujuan
             FROM pertambahan_spk
             WHERE id_spk = ANY($1::int[])
               AND UPPER(TRIM(COALESCE(status_persetujuan,''))) IN ('APPROVED','DISETUJUI','DISETUJUI BM')
             ORDER BY id`,
            [spkIds]
        );
        console.table(ptRes.rows);
    }

    console.log(`\n=== BERKAS SERAH TERIMA ===`);
    const stRes = await pool.query(
        `SELECT id, id_toko, created_at FROM berkas_serah_terima WHERE id_toko = ANY($1::int[]) ORDER BY id`,
        [tokoIds]
    );
    console.table(stRes.rows);

    console.log(`\n=== OPNAME FINAL ===`);
    const ofRes = await pool.query(
        `SELECT id, id_toko, status_opname_final, hari_denda, nilai_denda,
                tanggal_akhir_spk_denda, tanggal_serah_terima_denda, created_at
         FROM opname_final WHERE id_toko = ANY($1::int[]) ORDER BY id`,
        [tokoIds]
    );
    console.table(ofRes.rows);

    await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
