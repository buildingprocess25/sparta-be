import * as xlsx from "xlsx";
import type { PoolClient } from "pg";
import { AppError } from "../../common/app-error";
import { pool, withTransaction } from "../../db/pool";
import { activityLogRepository } from "../activity-log/activity-log.repository";
import type { RabMigrationAction, RabMigrationCommitInput } from "./rab-migration.schema";

type CellRecord = Record<string, unknown>;

type SourceToko = {
    source_toko_id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

type SourceRab = {
    source_rab_id: number;
    source_toko_id: number;
    status: string | null;
    nama_pt: string | null;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    link_pdf_sph: string | null;
    logo: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    alasan_penolakan: string | null;
    waktu_penolakan: string | null;
    ditolak_oleh: string | null;
    durasi_pekerjaan: string | null;
    kategori_lokasi: string | null;
    no_polis: string | null;
    berlaku_polis: string | null;
    file_asuransi: string | null;
    luas_bangunan: string | null;
    luas_terbangun: string | null;
    luas_area_terbuka: string | null;
    luas_area_parkir: string | null;
    luas_area_sales: string | null;
    luas_gudang: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string | null;
};

type SourceRabItem = {
    source_item_id: number | null;
    source_rab_id: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: string;
    harga_material: string;
    harga_upah: string;
    total_material: string;
    total_upah: string;
    total_harga: string;
    catatan: string | null;
};

type Candidate = {
    source_rab_id: number;
    source_toko_id: number;
    toko: SourceToko | null;
    rab: SourceRab;
    items: SourceRabItem[];
    issues: string[];
};

type ExistingRab = {
    existing_toko_id: number | null;
    existing_rab_id: number | null;
    existing_created_at: string | null;
    existing_item_count: number;
};

let rabCreatedAtColumnCache: boolean | null = null;

const ensureRabCreatedAtColumnKnown = async (db: PoolClient | typeof pool): Promise<boolean> => {
    if (rabCreatedAtColumnCache !== null) return rabCreatedAtColumnCache;

    const columnCheck = await db.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM pg_attribute
            WHERE attrelid = 'rab'::regclass
              AND attname = 'created_at'
              AND NOT attisdropped
        ) AS exists
        `
    );
    rabCreatedAtColumnCache = columnCheck.rows[0]?.exists ?? false;
    return rabCreatedAtColumnCache;
};

const REQUIRED_SHEETS = ["toko", "rab", "rab_item"];

const hasSuperHumanRole = (role: string) => role.toUpperCase().includes("SUPER HUMAN");

const normalizeCell = (value: unknown): string => String(value ?? "").trim();

const nullableText = (value: unknown): string | null => {
    const text = normalizeCell(value);
    return text ? text : null;
};

const toSourceId = (value: unknown): number | null => {
    const parsed = Number(normalizeCell(value));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const excelDateToIso = (value: unknown): string | null => {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 19).replace("T", " ");
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 19).replace("T", " ");
    }
    const raw = normalizeCell(value);
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 19).replace("T", " ");
    if (raw.includes("/")) {
        const parts = raw.split("/");
        if (parts.length === 3) {
            const monthFirst = Number(parts[0]) > 12 ? false : Number(parts[1]) > 12 ? true : true;
            const day = monthFirst ? parts[1] : parts[0];
            const month = monthFirst ? parts[0] : parts[1];
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")} 00:00:00`;
        }
    }
    return raw;
};

const numberText = (value: unknown): string => {
    const text = normalizeCell(value);
    if (!text) return "0";
    const numeric = Number(text.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(numeric) ? String(numeric) : text;
};

const integerMoneyText = (value: unknown): string => {
    const numeric = Number(numberText(value));
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : "0";
};

const readRows = (workbook: xlsx.WorkBook, sheetName: string): CellRecord[] => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return xlsx.utils.sheet_to_json<CellRecord>(sheet, { defval: "", raw: true });
};

const parseWorkbook = (buffer: Buffer): Candidate[] => {
    if (!buffer.length) throw new AppError("File Excel wajib diupload", 400);

    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    const missingSheets = REQUIRED_SHEETS.filter((sheet) => !workbook.Sheets[sheet]);
    if (missingSheets.length > 0) {
        throw new AppError(`Sheet wajib tidak ditemukan: ${missingSheets.join(", ")}`, 400);
    }

    const tokoRows = readRows(workbook, "toko");
    const rabRows = readRows(workbook, "rab");
    const itemRows = readRows(workbook, "rab_item");

    const tokoById = new Map<number, SourceToko>();
    for (const row of tokoRows) {
        const id = toSourceId(row.id);
        const nomorUlok = nullableText(row.nomor_ulok);
        if (!id || !nomorUlok) continue;

        tokoById.set(id, {
            source_toko_id: id,
            nomor_ulok: nomorUlok,
            lingkup_pekerjaan: nullableText(row.lingkup_pekerjaan),
            nama_toko: nullableText(row.nama_toko),
            kode_toko: nullableText(row.kode_toko),
            proyek: nullableText(row.proyek),
            cabang: nullableText(row.cabang),
            alamat: nullableText(row.alamat),
            nama_kontraktor: nullableText(row.nama_kontraktor)
        });
    }

    const itemsByRabId = new Map<number, SourceRabItem[]>();
    for (const row of itemRows) {
        const sourceRabId = toSourceId(row.id_rab);
        const jenis = nullableText(row.jenis_pekerjaan);
        if (!sourceRabId || !jenis) continue;

        const item: SourceRabItem = {
            source_item_id: toSourceId(row.id),
            source_rab_id: sourceRabId,
            kategori_pekerjaan: nullableText(row.kategori_pekerjaan) ?? "LAINNYA",
            jenis_pekerjaan: jenis,
            satuan: nullableText(row.satuan) ?? "-",
            volume: numberText(row.volume),
            harga_material: integerMoneyText(row.harga_material),
            harga_upah: integerMoneyText(row.harga_upah),
            total_material: integerMoneyText(row.total_material),
            total_upah: integerMoneyText(row.total_upah),
            total_harga: integerMoneyText(row.total_harga),
            catatan: nullableText(row.catatan)
        };

        const items = itemsByRabId.get(sourceRabId) ?? [];
        items.push(item);
        itemsByRabId.set(sourceRabId, items);
    }

    const candidates: Candidate[] = [];
    for (const row of rabRows) {
        const sourceRabId = toSourceId(row.id);
        const sourceTokoId = toSourceId(row.id_toko);
        if (!sourceRabId || !sourceTokoId) continue;

        const rab: SourceRab = {
            source_rab_id: sourceRabId,
            source_toko_id: sourceTokoId,
            status: nullableText(row.status),
            nama_pt: nullableText(row.nama_pt),
            link_pdf_gabungan: nullableText(row.link_pdf_gabungan),
            link_pdf_non_sbo: nullableText(row.link_pdf_non_sbo),
            link_pdf_rekapitulasi: nullableText(row.link_pdf_rekapitulasi),
            link_pdf_sph: nullableText(row.link_pdf_sph),
            logo: nullableText(row.logo),
            email_pembuat: nullableText(row.email_pembuat),
            pemberi_persetujuan_direktur: nullableText(row.pemberi_persetujuan_direktur),
            waktu_persetujuan_direktur: excelDateToIso(row.waktu_persetujuan_direktur),
            pemberi_persetujuan_koordinator: nullableText(row.pemberi_persetujuan_koordinator),
            waktu_persetujuan_koordinator: excelDateToIso(row.waktu_persetujuan_koordinator),
            pemberi_persetujuan_manager: nullableText(row.pemberi_persetujuan_manager),
            waktu_persetujuan_manager: excelDateToIso(row.waktu_persetujuan_manager),
            alasan_penolakan: nullableText(row.alasan_penolakan),
            waktu_penolakan: excelDateToIso(row.waktu_penolakan),
            ditolak_oleh: nullableText(row.ditolak_oleh),
            durasi_pekerjaan: nullableText(row.durasi_pekerjaan),
            kategori_lokasi: nullableText(row.kategori_lokasi),
            no_polis: nullableText(row.no_polis),
            berlaku_polis: nullableText(row.berlaku_polis),
            file_asuransi: nullableText(row.file_asuransi),
            luas_bangunan: nullableText(row.luas_bangunan),
            luas_terbangun: nullableText(row.luas_terbangun),
            luas_area_terbuka: nullableText(row.luas_area_terbuka),
            luas_area_parkir: nullableText(row.luas_area_parkir),
            luas_area_sales: nullableText(row.luas_area_sales),
            luas_gudang: nullableText(row.luas_gudang),
            grand_total: integerMoneyText(row.grand_total),
            grand_total_non_sbo: integerMoneyText(row.grand_total_non_sbo),
            grand_total_final: integerMoneyText(row.grand_total_final),
            created_at: excelDateToIso(row.created_at)
        };

        const toko = tokoById.get(sourceTokoId) ?? null;
        const items = itemsByRabId.get(sourceRabId) ?? [];
        const issues: string[] = [];
        if (!toko) issues.push(`Toko source id ${sourceTokoId} tidak ditemukan`);
        if (items.length === 0) issues.push("RAB tidak memiliki item");
        if (toko && !toko.nomor_ulok) issues.push("Nomor ULOK kosong");

        candidates.push({
            source_rab_id: sourceRabId,
            source_toko_id: sourceTokoId,
            toko,
            rab,
            items,
            issues
        });
    }

    return candidates;
};

const findExistingRab = async (candidate: Candidate, client?: PoolClient): Promise<ExistingRab> => {
    if (!candidate.toko) {
        return { existing_toko_id: null, existing_rab_id: null, existing_created_at: null, existing_item_count: 0 };
    }

    const db = client ?? pool;
    await ensureRabCreatedAtColumnKnown(db);

    const createdAtSelect = rabCreatedAtColumnCache ? "r.created_at AS rab_created_at," : "NULL::timestamp AS rab_created_at,";
    const createdAtInnerSelect = rabCreatedAtColumnCache ? "id, created_at" : "id";
    const createdAtOrder = rabCreatedAtColumnCache ? "created_at DESC," : "";
    const result = await db.query<{
        toko_id: number;
        rab_id: number | null;
        rab_created_at: string | null;
        item_count: string | number | null;
    }>(
        `
        SELECT
            t.id AS toko_id,
            r.id AS rab_id,
            ${createdAtSelect}
            COUNT(ri.id) AS item_count
        FROM toko t
        LEFT JOIN LATERAL (
            SELECT ${createdAtInnerSelect}
            FROM rab
            WHERE id_toko = t.id
            ORDER BY ${createdAtOrder} id DESC
            LIMIT 1
        ) r ON TRUE
        LEFT JOIN rab_item ri ON ri.id_rab = r.id
        WHERE t.nomor_ulok = $1
          AND LOWER(COALESCE(t.lingkup_pekerjaan, '')) = LOWER(COALESCE($2, ''))
        GROUP BY 1, 2, 3
        ORDER BY t.id DESC
        LIMIT 1
        `,
        [candidate.toko.nomor_ulok, candidate.toko.lingkup_pekerjaan]
    );

    const row = result.rows[0];
    if (!row) return { existing_toko_id: null, existing_rab_id: null, existing_created_at: null, existing_item_count: 0 };

    return {
        existing_toko_id: row.toko_id,
        existing_rab_id: row.rab_id,
        existing_created_at: row.rab_created_at ?? null,
        existing_item_count: Number(row.item_count ?? 0)
    };
};

const existingKey = (nomorUlok: string, lingkup?: string | null) =>
    `${nomorUlok.trim()}\u0000${String(lingkup ?? "").trim().toLowerCase()}`;

const findExistingRabs = async (candidates: Candidate[]): Promise<Map<string, ExistingRab>> => {
    const validCandidates = candidates.filter((candidate): candidate is Candidate & { toko: SourceToko } => Boolean(candidate.toko));
    const resultMap = new Map<string, ExistingRab>();
    if (validCandidates.length === 0) return resultMap;

    await ensureRabCreatedAtColumnKnown(pool);
    const createdAtSelect = rabCreatedAtColumnCache ? "r.created_at AS rab_created_at," : "NULL::timestamp AS rab_created_at,";
    const createdAtInnerSelect = rabCreatedAtColumnCache ? "id, created_at" : "id";
    const createdAtOrder = rabCreatedAtColumnCache ? "created_at DESC," : "";

    const uniqueKeys = new Set<string>();
    const values: string[] = [];
    const placeholders: string[] = [];
    for (const candidate of validCandidates) {
        const key = existingKey(candidate.toko.nomor_ulok, candidate.toko.lingkup_pekerjaan);
        if (uniqueKeys.has(key)) continue;
        uniqueKeys.add(key);
        const base = values.length;
        placeholders.push(`($${base + 1}, $${base + 2})`);
        values.push(candidate.toko.nomor_ulok, candidate.toko.lingkup_pekerjaan ?? "");
    }

    const existingRows = await pool.query<{
        nomor_ulok: string;
        lingkup_pekerjaan: string;
        toko_id: number | null;
        rab_id: number | null;
        rab_created_at: string | null;
        item_count: string | number | null;
    }>(
        `
        WITH wanted(nomor_ulok, lingkup_pekerjaan) AS (
            VALUES ${placeholders.join(", ")}
        )
        SELECT
            w.nomor_ulok,
            w.lingkup_pekerjaan,
            t.id AS toko_id,
            r.id AS rab_id,
            ${createdAtSelect}
            COUNT(ri.id) AS item_count
        FROM wanted w
        LEFT JOIN LATERAL (
            SELECT id
            FROM toko
            WHERE nomor_ulok = w.nomor_ulok
              AND LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER(COALESCE(w.lingkup_pekerjaan, ''))
            ORDER BY id DESC
            LIMIT 1
        ) t ON TRUE
        LEFT JOIN LATERAL (
            SELECT ${createdAtInnerSelect}
            FROM rab
            WHERE id_toko = t.id
            ORDER BY ${createdAtOrder} id DESC
            LIMIT 1
        ) r ON TRUE
        LEFT JOIN rab_item ri ON ri.id_rab = r.id
        GROUP BY 1, 2, 3, 4, 5
        `,
        values
    );

    for (const row of existingRows.rows) {
        resultMap.set(existingKey(row.nomor_ulok, row.lingkup_pekerjaan), {
            existing_toko_id: row.toko_id,
            existing_rab_id: row.rab_id,
            existing_created_at: row.rab_created_at ?? null,
            existing_item_count: Number(row.item_count ?? 0)
        });
    }

    return resultMap;
};

const insertOrUpdateToko = async (
    client: PoolClient,
    toko: SourceToko,
    existingTokoId: number | null,
    replaceToko: boolean
): Promise<number> => {
    if (existingTokoId) {
        if (replaceToko) {
            await client.query(
                `
                UPDATE toko
                SET lingkup_pekerjaan = $1,
                    nama_toko = $2,
                    kode_toko = $3,
                    proyek = $4,
                    cabang = $5,
                    alamat = $6,
                    nama_kontraktor = $7
                WHERE id = $8
                `,
                [
                    toko.lingkup_pekerjaan,
                    toko.nama_toko,
                    toko.kode_toko,
                    toko.proyek,
                    toko.cabang,
                    toko.alamat,
                    toko.nama_kontraktor,
                    existingTokoId
                ]
            );
        }
        return existingTokoId;
    }

    const inserted = await client.query<{ id: number }>(
        `
        INSERT INTO toko (
            nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko,
            proyek, cabang, alamat, nama_kontraktor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        `,
        [
            toko.nomor_ulok,
            toko.lingkup_pekerjaan,
            toko.nama_toko,
            toko.kode_toko,
            toko.proyek,
            toko.cabang,
            toko.alamat,
            toko.nama_kontraktor
        ]
    );

    return inserted.rows[0].id;
};

const insertRab = async (client: PoolClient, tokoId: number, rab: SourceRab): Promise<number> => {
    if (!rabCreatedAtColumnCache) {
        const result = await client.query<{ id: number }>(
            `
            INSERT INTO rab (
                id_toko, status, nama_pt, link_pdf_gabungan, link_pdf_non_sbo,
                link_pdf_rekapitulasi, link_pdf_sph, logo, email_pembuat,
                pemberi_persetujuan_direktur, waktu_persetujuan_direktur,
                pemberi_persetujuan_koordinator, waktu_persetujuan_koordinator,
                pemberi_persetujuan_manager, waktu_persetujuan_manager,
                alasan_penolakan, waktu_penolakan, ditolak_oleh, durasi_pekerjaan,
                kategori_lokasi, no_polis, berlaku_polis, file_asuransi,
                luas_bangunan, luas_terbangun, luas_area_terbuka, luas_area_parkir,
                luas_area_sales, luas_gudang, grand_total, grand_total_non_sbo,
                grand_total_final
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11::timestamp, $12, $13::timestamp, $14, $15::timestamp,
                $16, $17::timestamp, $18, $19, $20, $21, $22, $23,
                $24, $25, $26, $27, $28, $29, $30, $31, $32
            )
            RETURNING id
            `,
            [
                tokoId,
                rab.status,
                rab.nama_pt,
                rab.link_pdf_gabungan,
                rab.link_pdf_non_sbo,
                rab.link_pdf_rekapitulasi,
                rab.link_pdf_sph,
                rab.logo,
                rab.email_pembuat,
                rab.pemberi_persetujuan_direktur,
                rab.waktu_persetujuan_direktur,
                rab.pemberi_persetujuan_koordinator,
                rab.waktu_persetujuan_koordinator,
                rab.pemberi_persetujuan_manager,
                rab.waktu_persetujuan_manager,
                rab.alasan_penolakan,
                rab.waktu_penolakan,
                rab.ditolak_oleh,
                rab.durasi_pekerjaan,
                rab.kategori_lokasi,
                rab.no_polis,
                rab.berlaku_polis,
                rab.file_asuransi,
                rab.luas_bangunan,
                rab.luas_terbangun,
                rab.luas_area_terbuka,
                rab.luas_area_parkir,
                rab.luas_area_sales,
                rab.luas_gudang,
                rab.grand_total,
                rab.grand_total_non_sbo,
                rab.grand_total_final
            ]
        );

        return result.rows[0].id;
    }

    const result = await client.query<{ id: number }>(
        `
        INSERT INTO rab (
            id_toko, status, nama_pt, link_pdf_gabungan, link_pdf_non_sbo,
            link_pdf_rekapitulasi, link_pdf_sph, logo, email_pembuat,
            pemberi_persetujuan_direktur, waktu_persetujuan_direktur,
            pemberi_persetujuan_koordinator, waktu_persetujuan_koordinator,
            pemberi_persetujuan_manager, waktu_persetujuan_manager,
            alasan_penolakan, waktu_penolakan, ditolak_oleh, durasi_pekerjaan,
            kategori_lokasi, no_polis, berlaku_polis, file_asuransi,
            luas_bangunan, luas_terbangun, luas_area_terbuka, luas_area_parkir,
            luas_area_sales, luas_gudang, grand_total, grand_total_non_sbo,
            grand_total_final, created_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11::timestamp, $12, $13::timestamp, $14, $15::timestamp,
            $16, $17::timestamp, $18, $19, $20, $21, $22, $23,
            $24, $25, $26, $27, $28, $29, $30, $31, $32,
            COALESCE($33::timestamp, timezone('Asia/Jakarta', now()))
        )
        RETURNING id
        `,
        [
            tokoId,
            rab.status,
            rab.nama_pt,
            rab.link_pdf_gabungan,
            rab.link_pdf_non_sbo,
            rab.link_pdf_rekapitulasi,
            rab.link_pdf_sph,
            rab.logo,
            rab.email_pembuat,
            rab.pemberi_persetujuan_direktur,
            rab.waktu_persetujuan_direktur,
            rab.pemberi_persetujuan_koordinator,
            rab.waktu_persetujuan_koordinator,
            rab.pemberi_persetujuan_manager,
            rab.waktu_persetujuan_manager,
            rab.alasan_penolakan,
            rab.waktu_penolakan,
            rab.ditolak_oleh,
            rab.durasi_pekerjaan,
            rab.kategori_lokasi,
            rab.no_polis,
            rab.berlaku_polis,
            rab.file_asuransi,
            rab.luas_bangunan,
            rab.luas_terbangun,
            rab.luas_area_terbuka,
            rab.luas_area_parkir,
            rab.luas_area_sales,
            rab.luas_gudang,
            rab.grand_total,
            rab.grand_total_non_sbo,
            rab.grand_total_final,
            rab.created_at
        ]
    );

    return result.rows[0].id;
};

const updateRab = async (client: PoolClient, rabId: number, rab: SourceRab): Promise<void> => {
    const createdAtSet = rabCreatedAtColumnCache
        ? `,
            created_at = COALESCE($32::timestamp, created_at)`
        : "";

    const values: Array<string | number | null> = [
        rab.status,
        rab.nama_pt,
        rab.link_pdf_gabungan,
        rab.link_pdf_non_sbo,
        rab.link_pdf_rekapitulasi,
        rab.link_pdf_sph,
        rab.logo,
        rab.email_pembuat,
        rab.pemberi_persetujuan_direktur,
        rab.waktu_persetujuan_direktur,
        rab.pemberi_persetujuan_koordinator,
        rab.waktu_persetujuan_koordinator,
        rab.pemberi_persetujuan_manager,
        rab.waktu_persetujuan_manager,
        rab.alasan_penolakan,
        rab.waktu_penolakan,
        rab.ditolak_oleh,
        rab.durasi_pekerjaan,
        rab.kategori_lokasi,
        rab.no_polis,
        rab.berlaku_polis,
        rab.file_asuransi,
        rab.luas_bangunan,
        rab.luas_terbangun,
        rab.luas_area_terbuka,
        rab.luas_area_parkir,
        rab.luas_area_sales,
        rab.luas_gudang,
        rab.grand_total,
        rab.grand_total_non_sbo,
        rab.grand_total_final
    ];

    if (rabCreatedAtColumnCache) values.push(rab.created_at);
    values.push(rabId);

    await client.query(
        `
        UPDATE rab
        SET status = $1,
            nama_pt = $2,
            link_pdf_gabungan = $3,
            link_pdf_non_sbo = $4,
            link_pdf_rekapitulasi = $5,
            link_pdf_sph = $6,
            logo = $7,
            email_pembuat = $8,
            pemberi_persetujuan_direktur = $9,
            waktu_persetujuan_direktur = $10::timestamp,
            pemberi_persetujuan_koordinator = $11,
            waktu_persetujuan_koordinator = $12::timestamp,
            pemberi_persetujuan_manager = $13,
            waktu_persetujuan_manager = $14::timestamp,
            alasan_penolakan = $15,
            waktu_penolakan = $16::timestamp,
            ditolak_oleh = $17,
            durasi_pekerjaan = $18,
            kategori_lokasi = $19,
            no_polis = $20,
            berlaku_polis = $21,
            file_asuransi = $22,
            luas_bangunan = $23,
            luas_terbangun = $24,
            luas_area_terbuka = $25,
            luas_area_parkir = $26,
            luas_area_sales = $27,
            luas_gudang = $28,
            grand_total = $29,
            grand_total_non_sbo = $30,
            grand_total_final = $31
            ${createdAtSet}
        WHERE id = $${values.length}
        `,
        values
    );
};

const replaceItems = async (client: PoolClient, rabId: number, items: SourceRabItem[]): Promise<void> => {
    await client.query(`DELETE FROM rab_item WHERE id_rab = $1`, [rabId]);

    const chunkSize = 300;
    for (let start = 0; start < items.length; start += chunkSize) {
        const chunk = items.slice(start, start + chunkSize);
        const values: Array<string | number | null> = [];
        const placeholders: string[] = [];

        for (const item of chunk) {
            const base = values.length;
            placeholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`
            );
            values.push(
                rabId,
                item.kategori_pekerjaan,
                item.jenis_pekerjaan,
                item.satuan,
                item.volume,
                item.harga_material,
                item.harga_upah,
                item.total_material,
                item.total_upah,
                item.total_harga,
                item.catatan
            );
        }

        await client.query(
            `
            INSERT INTO rab_item (
                id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah, total_material,
                total_upah, total_harga, catatan
            ) VALUES ${placeholders.join(", ")}
            `,
            values
        );
    }
};

const applyCandidate = async (
    client: PoolClient,
    candidate: Candidate,
    action: RabMigrationAction
): Promise<{ action: RabMigrationAction; source_rab_id: number; target_rab_id: number | null; item_count: number; status: string }> => {
    if (action === "skip") {
        return {
            action,
            source_rab_id: candidate.source_rab_id,
            target_rab_id: null,
            item_count: candidate.items.length,
            status: "skipped"
        };
    }

    if (candidate.issues.length > 0 || !candidate.toko) {
        throw new AppError(`RAB source ${candidate.source_rab_id} tidak valid: ${candidate.issues.join(", ")}`, 422);
    }

    const existing = await findExistingRab(candidate, client);
    if (action === "insert" && existing.existing_rab_id) {
        throw new AppError(`RAB ${candidate.toko.nomor_ulok} ${candidate.toko.lingkup_pekerjaan ?? ""} sudah ada. Pilih replace atau skip.`, 409);
    }

    if (action !== "insert" && !existing.existing_rab_id) {
        throw new AppError(`RAB existing untuk source ${candidate.source_rab_id} tidak ditemukan. Gunakan insert.`, 404);
    }

    if (action === "update_created_at") {
        if (!rabCreatedAtColumnCache) {
            throw new AppError("Kolom rab.created_at belum tersedia. Jalankan migration add-rab-created-at terlebih dahulu.", 409);
        }
        if (!candidate.rab.created_at) {
            throw new AppError(`RAB source ${candidate.source_rab_id} tidak memiliki created_at di Excel`, 422);
        }

        const rabId = existing.existing_rab_id!;
        await client.query(
            `UPDATE rab SET created_at = $1::timestamp WHERE id = $2`,
            [candidate.rab.created_at, rabId]
        );

        return {
            action,
            source_rab_id: candidate.source_rab_id,
            target_rab_id: rabId,
            item_count: 0,
            status: "updated_created_at"
        };
    }

    if (action === "insert") {
        const tokoId = await insertOrUpdateToko(client, candidate.toko, existing.existing_toko_id, false);
        const rabId = await insertRab(client, tokoId, candidate.rab);
        await replaceItems(client, rabId, candidate.items);
        return {
            action,
            source_rab_id: candidate.source_rab_id,
            target_rab_id: rabId,
            item_count: candidate.items.length,
            status: "inserted"
        };
    }

    const rabId = existing.existing_rab_id!;
    if (action === "replace_toko_rab_items") {
        await insertOrUpdateToko(client, candidate.toko, existing.existing_toko_id, true);
        await updateRab(client, rabId, candidate.rab);
    } else if (action === "replace_rab_items") {
        await updateRab(client, rabId, candidate.rab);
    }

    await replaceItems(client, rabId, candidate.items);
    return {
        action,
        source_rab_id: candidate.source_rab_id,
        target_rab_id: rabId,
        item_count: candidate.items.length,
        status: "replaced"
    };
};

export const rabMigrationService = {
    async preview(buffer: Buffer, actorRole: string) {
        if (!hasSuperHumanRole(actorRole)) {
            throw new AppError("Hanya Super Human yang dapat melakukan migrasi RAB", 403);
        }

        const candidates = parseWorkbook(buffer);
        const existingByKey = await findExistingRabs(candidates);
        const details = [];
        let readyCount = 0;
        let conflictCount = 0;
        let missingCreatedAtCount = 0;
        let invalidCount = 0;
        let totalItems = 0;

        for (const candidate of candidates) {
            totalItems += candidate.items.length;
            const existing = candidate.toko
                ? existingByKey.get(existingKey(candidate.toko.nomor_ulok, candidate.toko.lingkup_pekerjaan))
                    ?? { existing_toko_id: null, existing_rab_id: null, existing_created_at: null, existing_item_count: 0 }
                : { existing_toko_id: null, existing_rab_id: null, existing_created_at: null, existing_item_count: 0 };
            const state = candidate.issues.length > 0
                ? "invalid"
                : existing.existing_rab_id
                    ? existing.existing_created_at
                        ? "conflict"
                        : "missing_created_at"
                    : "ready";

            if (state === "ready") readyCount += 1;
            if (state === "conflict") conflictCount += 1;
            if (state === "missing_created_at") missingCreatedAtCount += 1;
            if (state === "invalid") invalidCount += 1;

            details.push({
                source_rab_id: candidate.source_rab_id,
                source_toko_id: candidate.source_toko_id,
                nomor_ulok: candidate.toko?.nomor_ulok ?? "",
                lingkup_pekerjaan: candidate.toko?.lingkup_pekerjaan ?? "",
                nama_toko: candidate.toko?.nama_toko ?? "",
                cabang: candidate.toko?.cabang ?? "",
                status_rab: candidate.rab.status ?? "",
                item_count: candidate.items.length,
                grand_total: candidate.rab.grand_total ?? "0",
                db_state: state,
                existing_toko_id: existing.existing_toko_id,
                existing_rab_id: existing.existing_rab_id,
                existing_created_at: existing.existing_created_at,
                existing_item_count: existing.existing_item_count,
                issues: candidate.issues
            });
        }

        return {
            total_rab: candidates.length,
            total_items: totalItems,
            ready_count: readyCount,
            conflict_count: conflictCount,
            missing_created_at_count: missingCreatedAtCount,
            invalid_count: invalidCount,
            ignored_sheets: ["RAB import ", "RAB ITEM Import"].filter(Boolean),
            details
        };
    },

    async commit(buffer: Buffer, input: RabMigrationCommitInput) {
        if (!hasSuperHumanRole(input.actor_role)) {
            throw new AppError("Hanya Super Human yang dapat melakukan migrasi RAB", 403);
        }

        const candidates = parseWorkbook(buffer);
        const candidateBySourceId = new Map(candidates.map((candidate) => [candidate.source_rab_id, candidate]));
        const selected = input.selections.filter((selection) => selection.action !== "skip");

        const results = await withTransaction(async (client) => {
            const rowResults = [];
            for (const selection of input.selections) {
                const candidate = candidateBySourceId.get(selection.source_rab_id);
                if (!candidate) {
                    throw new AppError(`source_rab_id ${selection.source_rab_id} tidak ditemukan di file`, 404);
                }
                rowResults.push(await applyCandidate(client, candidate, selection.action));
            }

            await activityLogRepository.insert({
                entity_type: "RAB",
                entity_id: 0,
                actor_email: input.actor_email ?? null,
                actor_role: input.actor_role,
                action: "SUPER_HUMAN_MIGRATION",
                status_before: null,
                status_after: "MIGRATION_COMMITTED",
                reason: "Migrasi RAB dari file Excel",
                metadata: {
                    total_selected: input.selections.length,
                    total_executed: selected.length,
                    source_rab_ids: input.selections.map((selection) => selection.source_rab_id)
                }
            }, client);

            return rowResults;
        });

        const inserted = results.filter((row) => row.status === "inserted").length;
        const replaced = results.filter((row) => row.status === "replaced").length;
        const updatedCreatedAt = results.filter((row) => row.status === "updated_created_at").length;
        const skipped = results.filter((row) => row.status === "skipped").length;
        const itemCount = results.reduce((sum, row) => sum + row.item_count, 0);

        return {
            total_selected: input.selections.length,
            inserted,
            replaced,
            updated_created_at: updatedCreatedAt,
            skipped,
            migrated_items: itemCount,
            details: results
        };
    }
};
