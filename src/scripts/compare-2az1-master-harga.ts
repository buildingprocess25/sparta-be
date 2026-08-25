import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ULOK = "2AZ1-2605-0005";
const CABANG = "REMBANG";

type MasterItem = {
    scope: "SIPIL" | "ME";
    category: string;
    job: string;
    satuan: string;
};

function loadEnvFile() {
    const envPath = path.resolve(__dirname, "../../../sparta-be.env");
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
}

const normalizeKey = (value: string) =>
    String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .trim();

const stopwords = new Set([
    "pekerjaan", "pasang", "pemasangan", "merk", "ukuran", "warna",
    "dan", "atau", "dengan", "untuk", "unit", "buah", "set", "type",
    "model", "khusus", "lokal", "full", "panel", "menggunakan",
    "include", "pipa", "condoit", "conduit", "putih",
]);

function tokens(value: string) {
    return normalizeKey(value)
        .split(" ")
        .filter((token) => token.length > 1 && !stopwords.has(token));
}

function levenshtein(left: string, right: string) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    const current = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
    }
    return previous[b.length];
}

function score(left: string, right: string) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    const stringScore = maxLen === 0 ? 0 : 1 - levenshtein(a, b) / maxLen;
    const at = new Set(tokens(a));
    const bt = new Set(tokens(b));
    let overlap = 0;
    at.forEach((token) => {
        if (bt.has(token)) overlap += 1;
    });
    const tokenScore = at.size + bt.size === 0 ? 0 : (2 * overlap) / (at.size + bt.size);
    const containsBonus = a.includes(b) || b.includes(a) ? 0.08 : 0;
    return Math.min(1, Math.max(stringScore, tokenScore * 0.78 + stringScore * 0.22 + containsBonus));
}

function bestMatch(job: string, category: string, master: MasterItem[]) {
    return master
        .map((item) => ({
            ...item,
            score: Math.min(1, score(job, item.job) + (normalizeKey(category) === normalizeKey(item.category) ? 0.04 : 0)),
        }))
        .sort((a, b) => b.score - a.score)[0] ?? null;
}

function csv(rows: Record<string, unknown>[]) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
        const text = value == null ? "" : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

async function main() {
    loadEnvFile();
    const { priceRabService } = await import("../modules/price-rab/price-rab.service");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    const [meData, sipilData] = await Promise.all([
        priceRabService.getData(CABANG, "ME"),
        priceRabService.getData(CABANG, "SIPIL"),
    ]);

    const flatten = (scope: "SIPIL" | "ME", data: Record<string, any[]>): MasterItem[] =>
        Object.entries(data).flatMap(([category, items]) =>
            items.map((item) => ({
                scope,
                category,
                job: String(item["Jenis Pekerjaan"] ?? ""),
                satuan: String(item["Satuan"] ?? ""),
            }))
        );

    const masterMe = flatten("ME", meData);
    const masterSipil = flatten("SIPIL", sipilData);

    const blockers = await pool.query(`
        WITH blocker AS (
            WITH ranked AS (
                SELECT t.id AS id_toko, t.lingkup_pekerjaan, g.id AS id_gantt, p.id AS id_pengawasan,
                       pgnt.tanggal_pengawasan, p.kategori_pekerjaan, p.jenis_pekerjaan, p.status,
                       ROW_NUMBER() OVER (
                           PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                           ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                       ) AS rn
                FROM toko t
                JOIN gantt_chart g ON g.id_toko = t.id
                JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
                JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
                WHERE t.nomor_ulok = $1
            )
            SELECT 'BELUM_SELESAI' AS blocker_type, *
            FROM ranked
            WHERE rn = 1 AND LOWER(TRIM(COALESCE(status, ''))) <> 'selesai'
            UNION ALL
            SELECT 'SELESAI_BELUM_OPNAME' AS blocker_type, ls.*
            FROM (
                SELECT t.id AS id_toko, t.lingkup_pekerjaan, g.id AS id_gantt, p.id AS id_pengawasan,
                       pgnt.tanggal_pengawasan, p.kategori_pekerjaan, p.jenis_pekerjaan, p.status,
                       ROW_NUMBER() OVER (
                           PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                           ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                       ) AS rn
                FROM toko t
                JOIN gantt_chart g ON g.id_toko = t.id
                JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
                JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
                WHERE t.nomor_ulok = $1 AND LOWER(TRIM(COALESCE(p.status, ''))) = 'selesai'
            ) ls
            WHERE ls.rn = 1
              AND NOT EXISTS (
                  SELECT 1
                  FROM opname_item oi
                  LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                  LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                  WHERE oi.id_toko = ls.id_toko
                    AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ls.kategori_pekerjaan, '')))
                    AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ls.jenis_pekerjaan, '')))
              )
        )
        SELECT blocker_type, lingkup_pekerjaan, id_toko, id_gantt, id_pengawasan,
               tanggal_pengawasan, kategori_pekerjaan, jenis_pekerjaan, status
        FROM blocker
        ORDER BY blocker_type, jenis_pekerjaan
    `, [ULOK]);

    const rabItems = await pool.query(`
        SELECT t.lingkup_pekerjaan, ri.id AS rab_item_id, ri.kategori_pekerjaan, ri.jenis_pekerjaan
        FROM toko t
        JOIN rab r ON r.id_toko = t.id
        JOIN rab_item ri ON ri.id_rab = r.id
        WHERE t.nomor_ulok = $1
    `, [ULOK]);

    const opnameItems = await pool.query(`
        SELECT t.lingkup_pekerjaan, oi.id AS opname_item_id,
               COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan) AS kategori_pekerjaan,
               COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan) AS jenis_pekerjaan
        FROM opname_item oi
        JOIN toko t ON t.id = oi.id_toko
        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
        WHERE t.nomor_ulok = $1
    `, [ULOK]);

    const findExisting = (rows: any[], scope: string, category: string, job: string) => {
        const exact = rows.find((row) =>
            row.lingkup_pekerjaan === scope
            && normalizeKey(row.kategori_pekerjaan) === normalizeKey(category)
            && normalizeKey(row.jenis_pekerjaan) === normalizeKey(job)
        );
        if (exact) return { exact: true, id: exact.rab_item_id ?? exact.opname_item_id };
        const fuzzy = rows
            .filter((row) => row.lingkup_pekerjaan === scope && normalizeKey(row.kategori_pekerjaan) === normalizeKey(category))
            .map((row) => ({ row, score: score(job, row.jenis_pekerjaan) }))
            .sort((a, b) => b.score - a.score)[0];
        return fuzzy && fuzzy.score >= 0.9 ? { exact: false, id: fuzzy.row.rab_item_id ?? fuzzy.row.opname_item_id, job: fuzzy.row.jenis_pekerjaan, score: fuzzy.score } : null;
    };

    const rows = blockers.rows.map((blocker: any) => {
        const me = bestMatch(blocker.jenis_pekerjaan, blocker.kategori_pekerjaan, masterMe);
        const sipil = bestMatch(blocker.jenis_pekerjaan, blocker.kategori_pekerjaan, masterSipil);
        const rabMe = findExisting(rabItems.rows, "ME", blocker.kategori_pekerjaan, blocker.jenis_pekerjaan);
        const rabSipil = findExisting(rabItems.rows, "SIPIL", blocker.kategori_pekerjaan, blocker.jenis_pekerjaan);
        const opnameMe = findExisting(opnameItems.rows, "ME", blocker.kategori_pekerjaan, blocker.jenis_pekerjaan);
        const opnameSipil = findExisting(opnameItems.rows, "SIPIL", blocker.kategori_pekerjaan, blocker.jenis_pekerjaan);
        const recommendation = (me?.score ?? 0) >= 0.82 && (me?.score ?? 0) > (sipil?.score ?? 0) + 0.08
            ? "ITEM_ME_BERSIHKAN_DARI_SIPIL"
            : (sipil?.score ?? 0) >= 0.82
                ? "ITEM_SIPIL_PERLU_DIISI_DI_SIPIL"
                : "REVIEW_MANUAL";

        return {
            blocker_type: blocker.blocker_type,
            current_scope: blocker.lingkup_pekerjaan,
            id_pengawasan: blocker.id_pengawasan,
            tanggal_pengawasan: blocker.tanggal_pengawasan,
            kategori_pengawasan: blocker.kategori_pekerjaan,
            jenis_pengawasan: blocker.jenis_pekerjaan,
            status_pengawasan: blocker.status,
            best_me_score: me?.score.toFixed(3),
            best_me_category: me?.category,
            best_me_job: me?.job,
            best_sipil_score: sipil?.score.toFixed(3),
            best_sipil_category: sipil?.category,
            best_sipil_job: sipil?.job,
            rab_me: rabMe ? JSON.stringify(rabMe) : "",
            rab_sipil: rabSipil ? JSON.stringify(rabSipil) : "",
            opname_me: opnameMe ? JSON.stringify(opnameMe) : "",
            opname_sipil: opnameSipil ? JSON.stringify(opnameSipil) : "",
            recommendation,
        };
    });

    const outDir = path.resolve(__dirname, "../../../outputs/audit-2az1-2605-0005");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "master-harga-comparison.csv"), csv(rows));
    fs.writeFileSync(path.join(outDir, "master-harga-comparison.json"), JSON.stringify(rows, null, 2));

    console.log(JSON.stringify({
        outDir,
        blockers: rows.length,
        recommendations: rows.reduce((acc: Record<string, number>, row) => {
            acc[row.recommendation] = (acc[row.recommendation] ?? 0) + 1;
            return acc;
        }, {}),
        files: ["master-harga-comparison.csv", "master-harga-comparison.json"],
    }, null, 2));

    await pool.end();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
