import { pool } from "./src/db/pool";

async function bench(label: string, fn: () => Promise<any>) {
    const t = Date.now();
    try {
        const res = await fn();
        const rows = Array.isArray(res?.rows) ? res.rows.length : "?";
        console.log(`${label}: ${Date.now() - t}ms (${rows} rows)`);
        return res;
    } catch(e: any) {
        console.log(`${label}: ERROR - ${e.message}`);
        return { rows: [] };
    }
}

async function run() {
    console.log("Profiling each query individually...\n");

    const tokoRes = await bench("toko (full)", () => 
        pool.query("SELECT id, nomor_ulok, lingkup_pekerjaan FROM toko ORDER BY id DESC")
    );
    const ids = tokoRes.rows.map((r: any) => r.id);
    const idArr = `{${ids.join(",")}}`;

    await bench("rab", () => pool.query(
        `SELECT r.id, r.id_toko FROM rab r LEFT JOIN toko t ON t.id = r.id_toko WHERE r.id_toko = ANY($1::int[])`,
        [idArr]
    ));

    const ganttRes = await bench("gantt_chart", () => pool.query(
        `SELECT id, id_toko FROM gantt_chart WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));
    const ganttIds = ganttRes.rows.map((r: any) => r.id);
    const ganttArr = ganttIds.length > 0 ? `{${ganttIds.join(",")}}` : `{}`;

    await bench("pengajuan_spk", () => pool.query(
        `SELECT p.id FROM pengajuan_spk p LEFT JOIN toko t ON t.nomor_ulok=p.nomor_ulok WHERE COALESCE(p.id_toko, t.id) = ANY($1::int[])`,
        [idArr]
    ));
    await bench("pic_pengawasan", () => pool.query(
        `SELECT p.id FROM pic_pengawasan p LEFT JOIN toko t ON t.nomor_ulok=p.nomor_ulok WHERE COALESCE(p.id_toko, t.id) = ANY($1::int[])`,
        [idArr]
    ));
    await bench("instruksi_lapangan", () => pool.query(
        `SELECT id FROM instruksi_lapangan WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));
    await bench("opname_final", () => pool.query(
        `SELECT id FROM opname_final WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));
    await bench("berkas_serah_terima", () => pool.query(
        `SELECT id FROM berkas_serah_terima WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));
    await bench("projek_planning", () => pool.query(
        `SELECT id FROM projek_planning WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));

    await bench("kategori_pekerjaan_gantt", () => pool.query(
        `SELECT id FROM kategori_pekerjaan_gantt WHERE id_gantt = ANY($1::int[])`,
        [ganttArr]
    ));
    await bench("day_gantt_chart", () => pool.query(
        `SELECT id FROM day_gantt_chart WHERE id_gantt = ANY($1::int[])`,
        [ganttArr]
    ));
    const pgRes = await bench("pengawasan_gantt", () => pool.query(
        `SELECT id FROM pengawasan_gantt WHERE id_gantt = ANY($1::int[])`,
        [ganttArr]
    ));
    await bench("pengawasan (HEAVY?)", () => pool.query(
        `SELECT id FROM pengawasan WHERE id_gantt = ANY($1::int[])`,
        [ganttArr]
    ));
    await bench("dependency_gantt", () => pool.query(
        `SELECT id FROM dependency_gantt WHERE id_gantt = ANY($1::int[])`,
        [ganttArr]
    ));

    const rabRes = await bench("rab (ids only)", () => pool.query(
        `SELECT id FROM rab WHERE id_toko = ANY($1::int[])`,
        [idArr]
    ));
    const rabIds = rabRes.rows.map((r: any) => r.id);
    const rabArr = rabIds.length > 0 ? `{${rabIds.join(",")}}` : `{}`;
    await bench("rab_item", () => pool.query(
        `SELECT id FROM rab_item WHERE id_rab = ANY($1::int[])`,
        [rabArr]
    ));

    const pgIds = pgRes.rows.map((r: any) => r.id);
    const pgArr = pgIds.length > 0 ? `{${pgIds.join(",")}}` : `{}`;
    await bench("berkas_pengawasan", () => pool.query(
        `SELECT id FROM berkas_pengawasan WHERE id_pengawasan_gantt = ANY($1::int[])`,
        [pgArr]
    ));

    console.log("\nDone!");
    await pool.end();
}

run().catch(console.error);
