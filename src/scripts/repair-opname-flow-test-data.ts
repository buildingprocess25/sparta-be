import pg from "pg";
import "dotenv/config";
import { GoogleProvider } from "../common/google";
import { rabService } from "../modules/rab/rab.service";
import { spkService } from "../modules/spk/spk.service";

const COMMIT = process.argv.includes("--commit");

const OLD_LEGACY_ULOK = "TEST-OPNAME-LGY-20260829";
const OLD_CONTRACTOR_FIRST_ULOK = "TEST-OPNAME-CF-20260829";
const NEW_LEGACY_ULOK = "Z001-2908-1829-R";
const NEW_CONTRACTOR_FIRST_ULOK = "Z001-2908-1830-R";

const BM_APPROVER_EMAIL = "wildan.fadillah@nusaputra.ac.id";
const BM_APPROVER_NAME = "MANAGER HO 2";

const targets = [
    {
        oldUlok: OLD_LEGACY_ULOK,
        newUlok: NEW_LEGACY_ULOK,
        namaToko: "TEST LEGACY OPNAME 20260829",
        kodeToko: "TL29",
        workflowVersion: "legacy",
        spkByScope: {
            SIPIL: "007/PROPNDEV-Z001/VIII/26",
            ME: "008/PROPNDEV-Z001/VIII/26"
        },
        dependenciesByScope: {
            SIPIL: [
                ["PEKERJAAN PERSIAPAN", "PEKERJAAN DINDING"],
                ["PEKERJAAN DINDING", "PEKERJAAN LANTAI"],
                ["PEKERJAAN LANTAI", "PEKERJAAN PLAFON"],
                ["PEKERJAAN PLAFON", "PEKERJAAN PENGECATAN"]
            ],
            ME: [
                ["INSTALASI", "FIXTURE"],
                ["FIXTURE", "PANEL"],
                ["PANEL", "PLUMBING"]
            ]
        }
    },
    {
        oldUlok: OLD_CONTRACTOR_FIRST_ULOK,
        newUlok: NEW_CONTRACTOR_FIRST_ULOK,
        namaToko: "TEST CONTRACTOR FIRST OPNAME 20260829",
        kodeToko: "TC29",
        workflowVersion: "contractor_first",
        spkByScope: {
            SIPIL: "009/PROPNDEV-Z001/VIII/26",
            ME: "010/PROPNDEV-Z001/VIII/26"
        },
        dependenciesByScope: {
            SIPIL: [
                ["PEKERJAAN PERSIAPAN", "PEKERJAAN DINDING"],
                ["PEKERJAAN DINDING", "PEKERJAAN LANTAI"],
                ["PEKERJAAN LANTAI", "PEKERJAAN PLAFON"],
                ["PEKERJAAN PLAFON", "PEKERJAAN PENGECATAN"]
            ],
            ME: [
                ["INSTALASI", "FIXTURE"],
                ["FIXTURE", "PANEL"],
                ["PANEL", "PLUMBING"]
            ]
        }
    }
] as const;

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 30000)
});

type Scope = keyof (typeof targets)[number]["spkByScope"];

function printPlan(): void {
    console.log(COMMIT ? "MODE: COMMIT" : "MODE: PREVIEW ONLY");
    for (const target of targets) {
        console.log(`${target.oldUlok} -> ${target.newUlok} (${target.workflowVersion})`);
        console.log(`  nama_toko=${target.namaToko}, kode_toko=${target.kodeToko}`);
        console.log(`  SPK SIPIL=${target.spkByScope.SIPIL}`);
        console.log(`  SPK ME=${target.spkByScope.ME}`);
        console.log(`  dependency SIPIL=${target.dependenciesByScope.SIPIL.length}, ME=${target.dependenciesByScope.ME.length}`);
    }
    console.log(`SPK approver: ${BM_APPROVER_NAME} (${BM_APPROVER_EMAIL})`);
}

async function assertNoNewIdentifierConflict(client: pg.PoolClient): Promise<void> {
    const newUloks = targets.map((target) => target.newUlok);
    const oldUloks = targets.map((target) => target.oldUlok);
    const newSpkNumbers = targets.flatMap((target) => Object.values(target.spkByScope));

    const existingNewUlok = await client.query(
        `SELECT nomor_ulok FROM toko WHERE nomor_ulok = ANY($1::text[]) AND nomor_ulok <> ALL($2::text[]) GROUP BY nomor_ulok`,
        [newUloks, oldUloks]
    );
    if (existingNewUlok.rowCount) {
        throw new Error(`Nomor ULOK tujuan sudah dipakai: ${existingNewUlok.rows.map((row) => row.nomor_ulok).join(", ")}`);
    }

    const existingSpk = await client.query(
        `
        SELECT nomor_spk
        FROM pengajuan_spk
        WHERE nomor_spk = ANY($1::text[])
          AND nomor_ulok <> ALL($2::text[])
        GROUP BY nomor_spk
        `,
        [newSpkNumbers, oldUloks]
    );
    if (existingSpk.rowCount) {
        throw new Error(`Nomor SPK tujuan sudah dipakai: ${existingSpk.rows.map((row) => row.nomor_spk).join(", ")}`);
    }
}

async function assertTargetsExist(client: pg.PoolClient): Promise<void> {
    const oldUloks = targets.map((target) => target.oldUlok);
    const result = await client.query(
        `
        SELECT nomor_ulok, lingkup_pekerjaan, COUNT(*)::int AS count
        FROM toko
        WHERE nomor_ulok = ANY($1::text[])
        GROUP BY nomor_ulok, lingkup_pekerjaan
        ORDER BY nomor_ulok, lingkup_pekerjaan
        `,
        [oldUloks]
    );

    console.log("Current target rows:");
    for (const row of result.rows) {
        console.log(`  ${row.nomor_ulok} / ${row.lingkup_pekerjaan}: ${row.count}`);
    }

    for (const target of targets) {
        for (const scope of ["SIPIL", "ME"] as const) {
            const found = result.rows.some((row) => row.nomor_ulok === target.oldUlok && row.lingkup_pekerjaan === scope);
            if (!found) throw new Error(`Target belum lengkap: ${target.oldUlok} / ${scope}`);
        }
    }
}

async function updateIdentifiers(client: pg.PoolClient): Promise<void> {
    for (const target of targets) {
        await client.query(
            `
            UPDATE toko
               SET nomor_ulok = $1,
                   nama_toko = $2,
                   kode_toko = $3
             WHERE nomor_ulok = $4
            `,
            [target.newUlok, target.namaToko, target.kodeToko, target.oldUlok]
        );
        await client.query(
            `
            UPDATE pic_pengawasan
               SET nomor_ulok = $1
             WHERE nomor_ulok = $2
            `,
            [target.newUlok, target.oldUlok]
        );

        for (const scope of ["SIPIL", "ME"] as const) {
            await client.query(
                `
                UPDATE pengajuan_spk
                   SET nomor_ulok = $1,
                       nomor_spk = $2,
                       approver_email = $3,
                       waktu_persetujuan = COALESCE(waktu_persetujuan, timezone('Asia/Jakarta', now()))
                 WHERE nomor_ulok = $4
                   AND lingkup_pekerjaan = $5
                `,
                [target.newUlok, target.spkByScope[scope], BM_APPROVER_EMAIL, target.oldUlok, scope]
            );
        }
    }
}

async function insertSpkApprovalLogs(client: pg.PoolClient): Promise<void> {
    const spks = await client.query<{ id: number }>(
        `
        SELECT ps.id
        FROM pengajuan_spk ps
        WHERE ps.nomor_ulok = ANY($1::text[])
        ORDER BY ps.id
        `,
        [targets.map((target) => target.newUlok)]
    );

    for (const spk of spks.rows) {
        await client.query(
            `
            INSERT INTO spk_approval_log (pengajuan_spk_id, approver_email, tindakan, alasan_penolakan, waktu_tindakan, catatan_approval)
            SELECT $1, $2, 'APPROVE', NULL, timezone('Asia/Jakarta', now()), 'Approval test data opname flow'
            WHERE NOT EXISTS (
                SELECT 1
                FROM spk_approval_log
                WHERE pengajuan_spk_id = $1
                  AND approver_email = $2
                  AND tindakan = 'APPROVE'
            )
            `,
            [spk.id, BM_APPROVER_EMAIL]
        );
    }
}

async function insertDependencies(client: pg.PoolClient): Promise<void> {
    for (const target of targets) {
        for (const scope of ["SIPIL", "ME"] as const) {
            const rows = await client.query<{ id: number; kategori_pekerjaan: string }>(
                `
                SELECT k.id, k.kategori_pekerjaan
                FROM toko t
                JOIN gantt_chart g ON g.id_toko = t.id
                JOIN kategori_pekerjaan_gantt k ON k.id_gantt = g.id
                WHERE t.nomor_ulok = $1
                  AND t.lingkup_pekerjaan = $2
                ORDER BY k.id
                `,
                [target.newUlok, scope]
            );
            const kategoriMap = new Map(rows.rows.map((row) => [row.kategori_pekerjaan, row.id]));
            for (const [source, targetCategory] of target.dependenciesByScope[scope] as ReadonlyArray<readonly [string, string]>) {
                const sourceId = kategoriMap.get(source);
                const targetId = kategoriMap.get(targetCategory);
                if (!sourceId || !targetId) {
                    throw new Error(`Kategori dependency tidak ditemukan: ${target.newUlok}/${scope} ${source} -> ${targetCategory}`);
                }
                await client.query(
                    `
                    INSERT INTO dependency_gantt (id_gantt, id_kategori, id_kategori_terikat)
                    SELECT g.id, $1, $2
                    FROM toko t
                    JOIN gantt_chart g ON g.id_toko = t.id
                    WHERE t.nomor_ulok = $3
                      AND t.lingkup_pekerjaan = $4
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dependency_gantt dep
                          WHERE dep.id_gantt = g.id
                            AND dep.id_kategori = $1
                            AND dep.id_kategori_terikat = $2
                      )
                    `,
                    [sourceId, targetId, target.newUlok, scope]
                );
            }
        }
    }
}

async function uploadSpkPdf(spkId: number): Promise<string | null> {
    const generated = await spkService.generatePdf(String(spkId));
    const data = await pool.query<{
        nomor_ulok: string;
        proyek: string | null;
        nama_toko: string | null;
        kode_toko: string | null;
        cabang: string | null;
    }>(
        `
        SELECT ps.nomor_ulok, ps.proyek, t.nama_toko, t.kode_toko, t.cabang
        FROM pengajuan_spk ps
        JOIN toko t ON t.id = ps.id_toko
        WHERE ps.id = $1
        `,
        [spkId]
    );
    const row = data.rows[0];
    if (!row) return null;

    const drive = GoogleProvider.instance.spartaDrive;
    if (!drive) throw new Error("Google Drive Sparta belum terkonfigurasi");
    const folderId = await GoogleProvider.instance.getOrCreateProcessFolder(
        "SPK",
        row.nomor_ulok,
        row.nama_toko,
        row.kode_toko,
        row.cabang
    );
    const upload = await GoogleProvider.instance.uploadFile(
        folderId,
        generated.filename,
        "application/pdf",
        generated.pdfBuffer,
        2,
        drive
    );
    return upload.webViewLink ?? `https://drive.google.com/file/d/${upload.id}/view`;
}

async function regeneratePdfs(): Promise<void> {
    const ids = await pool.query<{ rab_id: number; spk_id: number; nomor_ulok: string; lingkup_pekerjaan: string }>(
        `
        SELECT r.id AS rab_id, ps.id AS spk_id, t.nomor_ulok, t.lingkup_pekerjaan
        FROM toko t
        JOIN rab r ON r.id_toko = t.id
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        WHERE t.nomor_ulok = ANY($1::text[])
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
        `,
        [targets.map((target) => target.newUlok)]
    );

    for (const row of ids.rows) {
        console.log(`Regenerate RAB PDF: ${row.nomor_ulok}/${row.lingkup_pekerjaan} rab=${row.rab_id}`);
        await rabService.regeneratePdf(String(row.rab_id));

        console.log(`Regenerate SPK PDF: ${row.nomor_ulok}/${row.lingkup_pekerjaan} spk=${row.spk_id}`);
        const link = await uploadSpkPdf(row.spk_id);
        if (link) {
            await pool.query(`UPDATE pengajuan_spk SET link_pdf = $1 WHERE id = $2`, [link, row.spk_id]);
        }
    }
}

async function verify(): Promise<void> {
    const result = await pool.query(
        `
        SELECT
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            r.id AS rab_id,
            NULLIF(TRIM(COALESCE(r.link_pdf_gabungan, '')), '') IS NOT NULL AS rab_pdf_ok,
            ps.id AS spk_id,
            ps.nomor_spk,
            ps.approver_email,
            ps.waktu_persetujuan IS NOT NULL AS spk_approved_at_ok,
            NULLIF(TRIM(COALESCE(ps.link_pdf, '')), '') IS NOT NULL AS spk_pdf_ok,
            g.id AS gantt_id,
            COUNT(DISTINCT dep.id)::int AS dependency_count,
            COUNT(DISTINCT pg.id)::int AS checkpoint_count,
            MIN(pg.workflow_version) AS workflow_version
        FROM toko t
        JOIN rab r ON r.id_toko = t.id
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        JOIN gantt_chart g ON g.id_toko = t.id
        LEFT JOIN dependency_gantt dep ON dep.id_gantt = g.id
        LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
        WHERE t.nomor_ulok = ANY($1::text[])
        GROUP BY t.nomor_ulok, t.lingkup_pekerjaan, r.id, ps.id, ps.nomor_spk, ps.approver_email, ps.waktu_persetujuan, g.id
        ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
        `,
        [targets.map((target) => target.newUlok)]
    );

    console.log("Verification:");
    for (const row of result.rows) {
        console.log(JSON.stringify(row));
    }
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib di-set");

    printPlan();
    const client = await pool.connect();
    try {
        await assertTargetsExist(client);
        await assertNoNewIdentifierConflict(client);
        if (!COMMIT) {
            console.log("Preview selesai. Tidak ada data yang ditulis.");
            return;
        }

        await client.query("BEGIN");
        await updateIdentifiers(client);
        await insertSpkApprovalLogs(client);
        await insertDependencies(client);
        await client.query("COMMIT");
        console.log("Repair DB selesai. Mulai regenerate/upload PDF...");
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // ignore rollback errors
        }
        throw error;
    } finally {
        client.release();
    }

    if (COMMIT) {
        await regeneratePdfs();
        await verify();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
