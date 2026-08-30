import pg from "pg";
import "dotenv/config";

type WorkflowVersion = "legacy" | "contractor_first";
type Scope = "SIPIL" | "ME";

type RabItemSeed = {
    kategori: string;
    jenis: string;
    satuan: string;
    volume: number;
    hargaMaterial: number;
    hargaUpah: number;
};

type ScopeSeed = {
    scope: Scope;
    spkNumber: string;
    workflowVersion: WorkflowVersion;
    items: RabItemSeed[];
    ganttWindows: Array<{ kategori: string; hAwal: number; hAkhir: number }>;
};

type StoreSeed = {
    nomorUlok: string;
    namaToko: string;
    kodeToko: string;
    workflowVersion: WorkflowVersion;
    scopes: ScopeSeed[];
};

const COMMIT = process.argv.includes("--commit");

const TEST_RUN = "20260829";
const CONTRACTOR_EMAIL = "wzmobileindo@gmail.com";
const CONTRACTOR_NAME = "PT BERKAH HO";
const COORDINATOR_EMAIL = "charderrasnjy@gmail.com";
const COORDINATOR_NAME = "COORD HO";
const SUPPORT_EMAIL = "dimasfadly01@outlook.com";
const SUPPORT_NAME = "SUPPORT HO";
const CABANG = "HEAD OFFICE";
const PROYEK = "Renovasi";
const KATEGORI_LOKASI = "RUKO";
const SPK_START = "2026-09-01";
const SPK_END = "2026-09-20";
const DURATION_DAYS = 20;
const CHECKPOINT_DATES = ["2026-09-03", "2026-09-08", "2026-09-13", "2026-09-18", "2026-09-20"];

const sipilItems: RabItemSeed[] = [
    { kategori: "PEKERJAAN PERSIAPAN", jenis: "Pembersihan lokasi", satuan: "Ls", volume: 1, hargaMaterial: 0, hargaUpah: 750000 },
    { kategori: "PEKERJAAN DINDING", jenis: "Pasangan bata ringan", satuan: "m2", volume: 45, hargaMaterial: 85000, hargaUpah: 45000 },
    { kategori: "PEKERJAAN LANTAI", jenis: "Keramik area sales", satuan: "m2", volume: 60, hargaMaterial: 120000, hargaUpah: 55000 },
    { kategori: "PEKERJAAN PLAFON", jenis: "Plafon gypsum rangka hollow", satuan: "m2", volume: 55, hargaMaterial: 95000, hargaUpah: 50000 },
    { kategori: "PEKERJAAN PENGECATAN", jenis: "Cat dinding interior", satuan: "m2", volume: 120, hargaMaterial: 30000, hargaUpah: 18000 }
];

const meItems: RabItemSeed[] = [
    { kategori: "INSTALASI", jenis: "Instalasi titik lampu", satuan: "titik", volume: 24, hargaMaterial: 155000, hargaUpah: 40000 },
    { kategori: "INSTALASI", jenis: "Instalasi stop kontak", satuan: "titik", volume: 12, hargaMaterial: 180000, hargaUpah: 45000 },
    { kategori: "FIXTURE", jenis: "Lampu LED 18W", satuan: "bh", volume: 36, hargaMaterial: 65000, hargaUpah: 20000 },
    { kategori: "PANEL", jenis: "Panel listrik distribusi", satuan: "unit", volume: 1, hargaMaterial: 2500000, hargaUpah: 750000 },
    { kategori: "PLUMBING", jenis: "Instalasi floor drain", satuan: "titik", volume: 4, hargaMaterial: 225000, hargaUpah: 85000 }
];

const stores: StoreSeed[] = [
    {
        nomorUlok: `TEST-OPNAME-LGY-${TEST_RUN}`,
        namaToko: `TEST LEGACY OPNAME ${TEST_RUN}`,
        kodeToko: "TOL829",
        workflowVersion: "legacy",
        scopes: [
            {
                scope: "SIPIL",
                spkNumber: `TEST-LGY-SIPIL-${TEST_RUN}/SPK`,
                workflowVersion: "legacy",
                items: sipilItems,
                ganttWindows: [
                    { kategori: "PEKERJAAN PERSIAPAN", hAwal: 1, hAkhir: 2 },
                    { kategori: "PEKERJAAN DINDING", hAwal: 3, hAkhir: 8 },
                    { kategori: "PEKERJAAN LANTAI", hAwal: 9, hAkhir: 13 },
                    { kategori: "PEKERJAAN PLAFON", hAwal: 14, hAkhir: 17 },
                    { kategori: "PEKERJAAN PENGECATAN", hAwal: 18, hAkhir: 20 }
                ]
            },
            {
                scope: "ME",
                spkNumber: `TEST-LGY-ME-${TEST_RUN}/SPK`,
                workflowVersion: "legacy",
                items: meItems,
                ganttWindows: [
                    { kategori: "INSTALASI", hAwal: 1, hAkhir: 8 },
                    { kategori: "FIXTURE", hAwal: 9, hAkhir: 14 },
                    { kategori: "PANEL", hAwal: 15, hAkhir: 17 },
                    { kategori: "PLUMBING", hAwal: 18, hAkhir: 20 }
                ]
            }
        ]
    },
    {
        nomorUlok: `TEST-OPNAME-CF-${TEST_RUN}`,
        namaToko: `TEST CONTRACTOR FIRST OPNAME ${TEST_RUN}`,
        kodeToko: "TOC829",
        workflowVersion: "contractor_first",
        scopes: [
            {
                scope: "SIPIL",
                spkNumber: `TEST-CF-SIPIL-${TEST_RUN}/SPK`,
                workflowVersion: "contractor_first",
                items: sipilItems,
                ganttWindows: [
                    { kategori: "PEKERJAAN PERSIAPAN", hAwal: 1, hAkhir: 2 },
                    { kategori: "PEKERJAAN DINDING", hAwal: 3, hAkhir: 8 },
                    { kategori: "PEKERJAAN LANTAI", hAwal: 9, hAkhir: 13 },
                    { kategori: "PEKERJAAN PLAFON", hAwal: 14, hAkhir: 17 },
                    { kategori: "PEKERJAAN PENGECATAN", hAwal: 18, hAkhir: 20 }
                ]
            },
            {
                scope: "ME",
                spkNumber: `TEST-CF-ME-${TEST_RUN}/SPK`,
                workflowVersion: "contractor_first",
                items: meItems,
                ganttWindows: [
                    { kategori: "INSTALASI", hAwal: 1, hAkhir: 8 },
                    { kategori: "FIXTURE", hAwal: 9, hAkhir: 14 },
                    { kategori: "PANEL", hAwal: 15, hAkhir: 17 },
                    { kategori: "PLUMBING", hAwal: 18, hAkhir: 20 }
                ]
            }
        ]
    }
];

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 30000)
});

function formatMoney(value: number): string {
    return Math.round(value).toString();
}

function itemTotal(item: RabItemSeed): number {
    return item.volume * (item.hargaMaterial + item.hargaUpah);
}

function scopeTotal(scope: ScopeSeed): number {
    return scope.items.reduce((sum, item) => sum + itemTotal(item), 0);
}

function printPlan(): void {
    console.log(COMMIT ? "MODE: COMMIT" : "MODE: PREVIEW ONLY");
    console.log(`Run: ${TEST_RUN}`);
    console.log(`Cabang: ${CABANG}`);
    console.log(`Kontraktor: ${CONTRACTOR_NAME} (${CONTRACTOR_EMAIL})`);
    console.log(`Koordinator: ${COORDINATOR_NAME} (${COORDINATOR_EMAIL})`);
    console.log(`Support: ${SUPPORT_NAME} (${SUPPORT_EMAIL})`);
    console.log(`SPK: ${SPK_START} s/d ${SPK_END}, durasi ${DURATION_DAYS} hari`);
    console.log(`Checkpoint support: ${CHECKPOINT_DATES.join(", ")}`);
    console.log(`Slot opname contractor-first H-1: ${CHECKPOINT_DATES.map((date) => previousCalendarDate(date)).join(", ")}`);
    console.log("");

    for (const store of stores) {
        console.log(`${store.nomorUlok} | ${store.namaToko} | workflow=${store.workflowVersion}`);
        for (const scope of store.scopes) {
            console.log(`  - ${scope.scope}: RAB/SPK total Rp ${scopeTotal(scope).toLocaleString("id-ID")} | ${scope.spkNumber}`);
            for (const item of scope.items) {
                console.log(`    * ${item.kategori} / ${item.jenis} / ${item.volume} ${item.satuan} / Rp ${itemTotal(item).toLocaleString("id-ID")}`);
            }
        }
    }
}

function previousCalendarDate(value: string): string {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

async function assertReferenceUsers(client: pg.PoolClient): Promise<void> {
    const result = await client.query(
        `
        SELECT lower(email_sat) AS email, nama_lengkap, nama_pt, cabang
        FROM user_cabang
        WHERE lower(email_sat) = ANY($1::text[])
        `,
        [[CONTRACTOR_EMAIL, COORDINATOR_EMAIL, SUPPORT_EMAIL].map((email) => email.toLowerCase())]
    );
    const found = new Set(result.rows.map((row) => row.email));
    for (const email of [CONTRACTOR_EMAIL, COORDINATOR_EMAIL, SUPPORT_EMAIL]) {
        if (!found.has(email.toLowerCase())) {
            throw new Error(`Reference user tidak ditemukan di user_cabang: ${email}`);
        }
    }
}

async function assertNoDuplicates(client: pg.PoolClient): Promise<void> {
    const uloks = stores.map((store) => store.nomorUlok);
    const spkNumbers = stores.flatMap((store) => store.scopes.map((scope) => scope.spkNumber));

    const existingToko = await client.query(`SELECT nomor_ulok FROM toko WHERE nomor_ulok = ANY($1::text[])`, [uloks]);
    if (existingToko.rowCount) {
        throw new Error(`Nomor ULOK test sudah ada: ${existingToko.rows.map((row) => row.nomor_ulok).join(", ")}`);
    }

    const existingSpk = await client.query(`SELECT nomor_spk FROM pengajuan_spk WHERE nomor_spk = ANY($1::text[])`, [spkNumbers]);
    if (existingSpk.rowCount) {
        throw new Error(`Nomor SPK test sudah ada: ${existingSpk.rows.map((row) => row.nomor_spk).join(", ")}`);
    }
}

async function insertScope(client: pg.PoolClient, store: StoreSeed, scope: ScopeSeed): Promise<void> {
    const total = scopeTotal(scope);
    const toko = await client.query<{ id: number }>(
        `
        INSERT INTO toko (nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        `,
        [
            store.nomorUlok,
            scope.scope,
            store.namaToko,
            store.kodeToko,
            PROYEK,
            CABANG,
            "Data test opname flow - jangan dipakai operasional",
            CONTRACTOR_NAME
        ]
    );
    const tokoId = toko.rows[0].id;

    const rab = await client.query<{ id: number }>(
        `
        INSERT INTO rab (
            id_toko, status, nama_pt, email_pembuat, logo,
            pemberi_persetujuan_koordinator, nama_persetujuan_koordinator, waktu_persetujuan_koordinator,
            pemberi_persetujuan_manager, nama_persetujuan_manager, waktu_persetujuan_manager,
            pemberi_persetujuan_direktur, nama_persetujuan_direktur, waktu_persetujuan_direktur,
            durasi_pekerjaan, kategori_lokasi,
            luas_bangunan, luas_terbangun, luas_area_terbuka, luas_area_parkir, luas_area_sales, luas_gudang,
            grand_total, grand_total_non_sbo, grand_total_final, created_at
        ) VALUES (
            $1,'Disetujui',$2,$3,NULL,
            $4,$5,timezone('Asia/Jakarta', now()),
            $6,$7,timezone('Asia/Jakarta', now()),
            $8,$9,timezone('Asia/Jakarta', now()),
            $10,$11,
            '120','100','10','25','75','20',
            $12,$13,$14,timezone('Asia/Jakarta', now())
        )
        RETURNING id
        `,
        [
            tokoId,
            CONTRACTOR_NAME,
            CONTRACTOR_EMAIL,
            COORDINATOR_EMAIL,
            COORDINATOR_NAME,
            "manager.test@sat.co.id",
            "MANAGER TEST",
            "direktur.test@sat.co.id",
            "DIREKTUR TEST",
            String(DURATION_DAYS),
            KATEGORI_LOKASI,
            formatMoney(total),
            formatMoney(total),
            formatMoney(total)
        ]
    );
    const rabId = rab.rows[0].id;

    for (const item of scope.items) {
        const totalMaterial = item.volume * item.hargaMaterial;
        const totalUpah = item.volume * item.hargaUpah;
        await client.query(
            `
            INSERT INTO rab_item (
                id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah, total_material, total_upah, total_harga, catatan
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
            `,
            [
                rabId,
                item.kategori,
                item.jenis,
                item.satuan,
                item.volume.toString(),
                formatMoney(item.hargaMaterial),
                formatMoney(item.hargaUpah),
                formatMoney(totalMaterial),
                formatMoney(totalUpah),
                formatMoney(totalMaterial + totalUpah)
            ]
        );
    }

    const spk = await client.query<{ id: number }>(
        `
        INSERT INTO pengajuan_spk (
            id_toko, nomor_ulok, email_pembuat, lingkup_pekerjaan, nama_kontraktor, proyek,
            waktu_mulai, durasi, waktu_selesai, grand_total, terbilang, nomor_spk,
            par, spk_manual_1, spk_manual_2, status, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'','','','SPK_APPROVED',timezone('Asia/Jakarta', now()))
        RETURNING id
        `,
        [
            tokoId,
            store.nomorUlok,
            CONTRACTOR_EMAIL,
            scope.scope,
            CONTRACTOR_NAME,
            PROYEK,
            SPK_START,
            DURATION_DAYS,
            SPK_END,
            formatMoney(total),
            "TERBILANG DATA TEST",
            scope.spkNumber
        ]
    );
    const spkId = spk.rows[0].id;

    const gantt = await client.query<{ id: number }>(
        `
        INSERT INTO gantt_chart (id_toko, status, email_pembuat, timestamp, lingkup_pekerjaan)
        VALUES ($1,'active',$2,timezone('Asia/Jakarta', now()),$3)
        RETURNING id
        `,
        [tokoId, COORDINATOR_EMAIL, scope.scope]
    );
    const ganttId = gantt.rows[0].id;

    for (const window of scope.ganttWindows) {
        const kategori = await client.query<{ id: number }>(
            `
            INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
            VALUES ($1,$2)
            RETURNING id
            `,
            [ganttId, window.kategori]
        );
        await client.query(
            `
            INSERT INTO day_gantt_chart (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
            VALUES ($1,$2,$3,$4,0,0)
            `,
            [ganttId, kategori.rows[0].id, window.hAwal, window.hAkhir]
        );
    }

    const pic = await client.query<{ id: number }>(
        `
        INSERT INTO pic_pengawasan (
            id_toko, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk, plc_building_support
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        `,
        [tokoId, store.nomorUlok, rabId, spkId, KATEGORI_LOKASI, `${DURATION_DAYS} Hari`, SPK_START, SUPPORT_NAME]
    );
    const picId = pic.rows[0].id;

    for (const checkpointDate of CHECKPOINT_DATES) {
        await client.query(
            `
            INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan, id_pic_pengawasan, workflow_version, created_at)
            VALUES ($1,$2,$3,$4,timezone('Asia/Jakarta', now()))
            `,
            [ganttId, checkpointDate, picId, scope.workflowVersion]
        );
    }

    console.log(
        `Inserted ${store.workflowVersion} ${scope.scope}: toko=${tokoId}, rab=${rabId}, spk=${spkId}, gantt=${ganttId}, pic=${picId}`
    );
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL wajib di-set");
    }

    printPlan();

    const client = await pool.connect();
    try {
        await assertReferenceUsers(client);
        await assertNoDuplicates(client);

        if (!COMMIT) {
            console.log("");
            console.log("Preview selesai. Tidak ada data yang ditulis.");
            console.log("Jalankan dengan --commit setelah disetujui untuk membuat data test di DB.");
            return;
        }

        await client.query("BEGIN");
        for (const store of stores) {
            for (const scope of store.scopes) {
                await insertScope(client, store, scope);
            }
        }
        await client.query("COMMIT");
        console.log("Commit selesai.");
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // no-op: rollback may fail when no transaction was opened
        }
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
