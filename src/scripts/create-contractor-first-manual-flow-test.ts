import "dotenv/config";
import { pool } from "../db/pool";
import { rabService } from "../modules/rab/rab.service";
import { ganttService } from "../modules/gantt/gantt.service";
import { spkService } from "../modules/spk/spk.service";

const COMMIT = process.argv.includes("--commit");

const NOMOR_ULOK = "Z001-2908-1831-R";
const NAMA_TOKO = "TEST CONTRACTOR FIRST MANUAL FLOW 20260829";
const KODE_TOKO = "TC31";
const CABANG = "HEAD OFFICE";
const PROYEK = "Renovasi";
const ALAMAT = "Data test contractor-first opname manual flow - jangan dipakai operasional";
const KATEGORI_LOKASI = "RUKO";
const DURASI = 20;
const SPK_START = "2026-09-01";

const CONTRACTOR_EMAIL = "wzmobileindo@gmail.com";
const CONTRACTOR_NAME = "PT BERKAH HO";
const CONTRACTOR_DIRECTOR_EMAIL = "wzmobileindo@gmail.com";
const CONTRACTOR_DIRECTOR_NAME = "DIREKTUR HO";

const COORDINATOR_EMAIL = "charderrasnjy@gmail.com";
const COORDINATOR_NAME = "COORD HO";
const MANAGER_EMAIL = "wildan.fadillah@nusaputra.ac.id";
const MANAGER_NAME = "MANAGER HO 2";
const SUPPORT_NAME = "SUPPORT HO";

const CHECKPOINTS = ["03/09/2026", "08/09/2026", "13/09/2026", "18/09/2026", "20/09/2026"];

type Scope = "SIPIL" | "ME";
type Item = {
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
};

type ScopePlan = {
    scope: Scope;
    items: Item[];
    day_items: Array<{
        kategori_pekerjaan: string;
        h_awal: string;
        h_akhir: string;
        keterlambatan?: string | null;
        kecepatan?: string | null;
    }>;
    dependencies: Array<{
        kategori_pekerjaan: string;
        kategori_pekerjaan_terikat: string;
    }>;
};

const scopes: ScopePlan[] = [
    {
        scope: "SIPIL",
        items: [
            { kategori_pekerjaan: "PEKERJAAN PERSIAPAN", jenis_pekerjaan: "Pembersihan lokasi", satuan: "Ls", volume: 1, harga_material: 0, harga_upah: 750000 },
            { kategori_pekerjaan: "PEKERJAAN DINDING", jenis_pekerjaan: "Pasangan bata ringan", satuan: "m2", volume: 45, harga_material: 85000, harga_upah: 45000 },
            { kategori_pekerjaan: "PEKERJAAN LANTAI", jenis_pekerjaan: "Keramik area sales", satuan: "m2", volume: 60, harga_material: 120000, harga_upah: 55000 },
            { kategori_pekerjaan: "PEKERJAAN PLAFON", jenis_pekerjaan: "Plafon gypsum rangka hollow", satuan: "m2", volume: 55, harga_material: 95000, harga_upah: 50000 },
            { kategori_pekerjaan: "PEKERJAAN PENGECATAN", jenis_pekerjaan: "Cat dinding interior", satuan: "m2", volume: 120, harga_material: 30000, harga_upah: 18000 }
        ],
        day_items: [
            { kategori_pekerjaan: "PEKERJAAN PERSIAPAN", h_awal: "1", h_akhir: "2" },
            { kategori_pekerjaan: "PEKERJAAN DINDING", h_awal: "3", h_akhir: "8" },
            { kategori_pekerjaan: "PEKERJAAN LANTAI", h_awal: "9", h_akhir: "13" },
            { kategori_pekerjaan: "PEKERJAAN PLAFON", h_awal: "14", h_akhir: "17" },
            { kategori_pekerjaan: "PEKERJAAN PENGECATAN", h_awal: "18", h_akhir: "20" }
        ],
        dependencies: [
            { kategori_pekerjaan: "PEKERJAAN DINDING", kategori_pekerjaan_terikat: "PEKERJAAN PERSIAPAN" },
            { kategori_pekerjaan: "PEKERJAAN LANTAI", kategori_pekerjaan_terikat: "PEKERJAAN DINDING" },
            { kategori_pekerjaan: "PEKERJAAN PLAFON", kategori_pekerjaan_terikat: "PEKERJAAN LANTAI" },
            { kategori_pekerjaan: "PEKERJAAN PENGECATAN", kategori_pekerjaan_terikat: "PEKERJAAN PLAFON" }
        ]
    },
    {
        scope: "ME",
        items: [
            { kategori_pekerjaan: "INSTALASI", jenis_pekerjaan: "Instalasi titik lampu", satuan: "titik", volume: 24, harga_material: 155000, harga_upah: 40000 },
            { kategori_pekerjaan: "INSTALASI", jenis_pekerjaan: "Instalasi stop kontak", satuan: "titik", volume: 12, harga_material: 180000, harga_upah: 45000 },
            { kategori_pekerjaan: "FIXTURE", jenis_pekerjaan: "Lampu LED 18W", satuan: "bh", volume: 36, harga_material: 65000, harga_upah: 20000 },
            { kategori_pekerjaan: "PANEL", jenis_pekerjaan: "Panel listrik distribusi", satuan: "unit", volume: 1, harga_material: 2500000, harga_upah: 750000 },
            { kategori_pekerjaan: "PLUMBING", jenis_pekerjaan: "Instalasi floor drain", satuan: "titik", volume: 4, harga_material: 225000, harga_upah: 85000 }
        ],
        day_items: [
            { kategori_pekerjaan: "INSTALASI", h_awal: "1", h_akhir: "8" },
            { kategori_pekerjaan: "FIXTURE", h_awal: "9", h_akhir: "14" },
            { kategori_pekerjaan: "PANEL", h_awal: "15", h_akhir: "17" },
            { kategori_pekerjaan: "PLUMBING", h_awal: "18", h_akhir: "20" }
        ],
        dependencies: [
            { kategori_pekerjaan: "FIXTURE", kategori_pekerjaan_terikat: "INSTALASI" },
            { kategori_pekerjaan: "PANEL", kategori_pekerjaan_terikat: "FIXTURE" },
            { kategori_pekerjaan: "PLUMBING", kategori_pekerjaan_terikat: "PANEL" }
        ]
    }
];

const itemTotal = (item: Item) => item.volume * (item.harga_material + item.harga_upah);
const scopeTotal = (scope: ScopePlan) => scope.items.reduce((sum, item) => sum + itemTotal(item), 0);
const categories = (scope: ScopePlan) => Array.from(new Set(scope.day_items.map((item) => item.kategori_pekerjaan)));

function printPlan(): void {
    console.log(COMMIT ? "MODE: COMMIT" : "MODE: PREVIEW ONLY");
    console.log(`ULOK: ${NOMOR_ULOK}`);
    console.log(`Toko: ${NAMA_TOKO}`);
    console.log(`Cabang: ${CABANG}`);
    console.log(`Kontraktor: ${CONTRACTOR_NAME} (${CONTRACTOR_EMAIL})`);
    console.log(`Durasi SPK: ${DURASI} hari mulai ${SPK_START}`);
    console.log(`PIC Support: ${SUPPORT_NAME}`);
    console.log(`Checkpoint pengawasan: ${CHECKPOINTS.join(", ")}`);
    for (const scope of scopes) {
        console.log(`${scope.scope}: total RAB Rp ${scopeTotal(scope).toLocaleString("id-ID")}`);
        console.log(`  kategori=${categories(scope).join(", ")}`);
        console.log(`  dependency=${scope.dependencies.length}`);
        console.log(`  item=${scope.items.length}`);
    }
}

async function assertSafeToCreate(): Promise<void> {
    const existing = await pool.query(
        `
        SELECT t.nomor_ulok, t.lingkup_pekerjaan, r.id AS rab_id, g.id AS gantt_id, ps.id AS spk_id
        FROM toko t
        LEFT JOIN rab r ON r.id_toko = t.id
        LEFT JOIN gantt_chart g ON g.id_toko = t.id
        LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id
        WHERE t.nomor_ulok = $1
        ORDER BY t.id
        `,
        [NOMOR_ULOK]
    );
    if (existing.rowCount) {
        console.log(JSON.stringify(existing.rows, null, 2));
        throw new Error(`ULOK ${NOMOR_ULOK} sudah ada. Script dibatalkan agar tidak membuat duplikasi.`);
    }
}

async function createScope(scope: ScopePlan): Promise<void> {
    console.log(`Submit RAB ${scope.scope}...`);
    const rab = await rabService.submit({
        nomor_ulok: NOMOR_ULOK,
        lingkup_pekerjaan: scope.scope,
        nama_toko: NAMA_TOKO,
        kode_toko: KODE_TOKO,
        proyek: PROYEK,
        cabang: CABANG,
        alamat: ALAMAT,
        nama_kontraktor: CONTRACTOR_NAME,
        email_pembuat: CONTRACTOR_EMAIL,
        nama_pt: CONTRACTOR_NAME,
        durasi_pekerjaan: String(DURASI),
        kategori_lokasi: KATEGORI_LOKASI,
        luas_bangunan: "120",
        luas_terbangun: "100",
        luas_area_terbuka: "10",
        luas_area_parkir: "25",
        luas_area_sales: "75",
        luas_gudang: "20",
        detail_items: scope.items
    });

    console.log(`Submit Gantt ${scope.scope}...`);
    const gantt = await ganttService.submit({
        nomor_ulok: NOMOR_ULOK,
        lingkup_pekerjaan: scope.scope,
        nama_toko: NAMA_TOKO,
        kode_toko: KODE_TOKO,
        proyek: PROYEK,
        cabang: CABANG,
        alamat: ALAMAT,
        nama_kontraktor: CONTRACTOR_NAME,
        email_pembuat: CONTRACTOR_EMAIL,
        kategori_pekerjaan: categories(scope),
        day_items: scope.day_items,
        dependencies: scope.dependencies
    });

    console.log(`Lock Gantt ${scope.scope}...`);
    await ganttService.lock(String(gantt.id), CONTRACTOR_EMAIL);

    console.log(`Approve RAB ${scope.scope} - Direktur kontraktor...`);
    await rabService.handleApproval(String(rab.id), {
        approver_email: CONTRACTOR_DIRECTOR_EMAIL,
        nama_lengkap: CONTRACTOR_DIRECTOR_NAME,
        jabatan: "DIREKTUR",
        tindakan: "APPROVE",
        catatan_approval: "Approval test contractor-first manual flow"
    });

    console.log(`Approve RAB ${scope.scope} - Koordinator...`);
    await rabService.handleApproval(String(rab.id), {
        approver_email: COORDINATOR_EMAIL,
        nama_lengkap: COORDINATOR_NAME,
        jabatan: "KOORDINATOR",
        tindakan: "APPROVE",
        catatan_approval: "Approval test contractor-first manual flow",
        beanspot_type: "TIDAK",
        is_hth: false,
        is_fasade: false
    });

    console.log(`Approve RAB ${scope.scope} - Manager...`);
    await rabService.handleApproval(String(rab.id), {
        approver_email: MANAGER_EMAIL,
        nama_lengkap: MANAGER_NAME,
        jabatan: "MANAGER",
        tindakan: "APPROVE",
        catatan_approval: "Approval test contractor-first manual flow"
    });

    console.log(`Submit SPK ${scope.scope}...`);
    const spk = await spkService.submit({
        id_toko: Number(rab.id_toko),
        nomor_ulok: NOMOR_ULOK,
        kode_toko: KODE_TOKO,
        email_pembuat: MANAGER_EMAIL,
        lingkup_pekerjaan: scope.scope,
        nama_kontraktor: CONTRACTOR_NAME,
        proyek: PROYEK,
        waktu_mulai: SPK_START,
        durasi: DURASI,
        grand_total: scopeTotal(scope),
        par: "",
        spk_manual_1: "VIII",
        spk_manual_2: "26"
    }, {
        session_id: 0,
        email_sat: MANAGER_EMAIL,
        nama_lengkap: MANAGER_NAME,
        jabatan: "BRANCH BUILDING & MAINTENANCE MANAGER",
        cabang: CABANG,
        roles: ["BRANCH BUILDING & MAINTENANCE MANAGER"],
        nama_pt: "PT SUMBER ALFARIA TRIJAYA, Tbk",
        expires_at: new Date(Date.now() + 86_400_000).toISOString()
    });

    console.log(`Approve SPK ${scope.scope}...`);
    await spkService.handleApproval(String(spk.id), {
        approver_email: MANAGER_EMAIL,
        tindakan: "APPROVE",
        catatan_approval: "Approval test contractor-first manual flow"
    });

    console.log(`Create PIC pengawasan/checkpoint ${scope.scope}...`);
    await ganttService.managePengawasan(String(gantt.id), {
        tanggal_pengawasan: CHECKPOINTS,
        pic_pengawasan: {
            id_toko: Number(rab.id_toko),
            nomor_ulok: NOMOR_ULOK,
            id_rab: Number(rab.id),
            id_spk: Number(spk.id),
            kategori_lokasi: KATEGORI_LOKASI,
            durasi: `${DURASI} Hari`,
            tanggal_mulai_spk: SPK_START,
            plc_building_support: SUPPORT_NAME
        }
    });

    console.log(`Done ${scope.scope}: rab=${rab.id}, gantt=${gantt.id}, spk=${spk.id}`);
}

async function verify(): Promise<void> {
    const result = await pool.query(
        `
        SELECT
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.id AS toko_id,
            r.id AS rab_id,
            r.status AS rab_status,
            NULLIF(TRIM(COALESCE(r.link_pdf_gabungan, '')), '') IS NOT NULL AS rab_pdf_ok,
            g.id AS gantt_id,
            g.status AS gantt_status,
            ps.id AS spk_id,
            ps.status AS spk_status,
            ps.nomor_spk,
            NULLIF(TRIM(COALESCE(ps.link_pdf, '')), '') IS NOT NULL AS spk_pdf_ok,
            pic.id AS pic_id,
            COUNT(DISTINCT ri.id)::int AS rab_items,
            COUNT(DISTINCT d.id)::int AS day_items,
            COUNT(DISTINCT dep.id)::int AS dependencies,
            COUNT(DISTINCT pg.id)::int AS checkpoints,
            MIN(pg.workflow_version) AS workflow_version_min,
            MAX(pg.workflow_version) AS workflow_version_max
        FROM toko t
        JOIN rab r ON r.id_toko = t.id
        JOIN rab_item ri ON ri.id_rab = r.id
        JOIN gantt_chart g ON g.id_toko = t.id
        JOIN day_gantt_chart d ON d.id_gantt = g.id
        LEFT JOIN dependency_gantt dep ON dep.id_gantt = g.id
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        JOIN pic_pengawasan pic ON pic.id_toko = t.id
        JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
        WHERE t.nomor_ulok = $1
        GROUP BY t.nomor_ulok, t.lingkup_pekerjaan, t.id, r.id, r.status, g.id, g.status, ps.id, ps.status, ps.nomor_spk, pic.id
        ORDER BY t.lingkup_pekerjaan
        `,
        [NOMOR_ULOK]
    );

    console.log("Verification:");
    for (const row of result.rows) {
        console.log(JSON.stringify(row));
    }
}

async function main(): Promise<void> {
    printPlan();
    await assertSafeToCreate();
    if (!COMMIT) {
        console.log("Preview selesai. Tidak ada data yang dibuat.");
        return;
    }

    for (const scope of scopes) {
        await createScope(scope);
    }
    await verify();
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
