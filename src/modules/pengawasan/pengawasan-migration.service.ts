import * as xlsx from "xlsx";
import type { PoolClient } from "pg";
import { AppError } from "../../common/app-error";
import { pool, withTransaction } from "../../db/pool";
import { activityLogRepository } from "../activity-log/activity-log.repository";
import type { PengawasanMigrationAction, PengawasanMigrationCommitInput } from "./pengawasan-migration.schema";

type CellRecord = Record<string, unknown>;

type PicSource = {
    nomor_ulok: string;
    nama_toko: string | null;
    lingkup_pekerjaan: string | null;
    kategori_lokasi: string | null;
    tanggal_mulai_spk: string | null;
    plc_building_support: string | null;
    spk_url: string | null;
    rab_url: string | null;
};

type HRowSource = {
    sheet_name: string;
    h_day: number;
    row_number: number;
    nomor_ulok: string;
    status_lokasi: string | null;
    progress: Array<{ status: string | null; catatan: string | null; ordinal: number }>;
    link_pdf: string | null;
};

type TargetContext = {
    toko_id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string | null;
    cabang: string | null;
    gantt_id: number | null;
    rab_id: number | null;
    spk_id: number | null;
    kategori_lokasi: string | null;
    durasi: string | null;
    tanggal_mulai_spk: string | null;
    existing_pic_id: number | null;
    pengawasan_gantt_id: number | null;
    existing_pengawasan_count: number;
    existing_pdf_link: string | null;
};

type WorkItem = {
    source_pengawasan_id: number;
    source: HRowSource;
    pic: PicSource | null;
    target: TargetContext | null;
    tanggal_pengawasan: string | null;
    pekerjaan: Array<{ kategori_pekerjaan: string; jenis_pekerjaan: string; catatan: string | null; status: "progress" | "selesai" | "terlambat" }>;
    issues: string[];
    warnings: string[];
};

const hasSuperHumanRole = (role: string) => role.toUpperCase().includes("SUPER HUMAN");

const normalizeCell = (value: unknown): string => String(value ?? "").trim();

const nullableText = (value: unknown): string | null => {
    const text = normalizeCell(value);
    return text ? text : null;
};

const normalizeKey = (value: unknown): string => normalizeCell(value).toUpperCase();

const readRows = (workbook: xlsx.WorkBook, sheetName: string): CellRecord[] => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return xlsx.utils.sheet_to_json<CellRecord>(sheet, { defval: "", raw: true });
};

const excelDateToDateOnly = (value: unknown): string | null => {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }

    const raw = normalizeCell(value);
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (raw.includes("/")) {
        const parts = raw.split("/").map((part) => part.trim());
        if (parts.length === 3) {
            const dayFirst = Number(parts[0]) > 12;
            const day = dayFirst ? parts[0] : parts[1];
            const month = dayFirst ? parts[1] : parts[0];
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime()) && /\d/.test(raw)) return parsed.toISOString().slice(0, 10);
    return null;
};

const formatDdMmYyyy = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const addDaysToDate = (dateOnly: string, days: number): string | null => {
    const date = new Date(`${dateOnly}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + days);
    return formatDdMmYyyy(date);
};

const normalizeLingkup = (value: string | null | undefined): string[] => {
    const text = normalizeKey(value);
    if (!text || text === "TERISI") return [];
    const scopes = new Set<string>();
    if (text.includes("SIPIL")) scopes.add("SIPIL");
    if (text === "ME" || text.includes("& ME") || text.includes(" ME") || text.includes("M&E")) scopes.add("ME");
    if (scopes.size === 0) scopes.add(text);
    return [...scopes];
};

const mapPengawasanStatus = (value: string | null): "progress" | "selesai" | "terlambat" => {
    const status = normalizeKey(value);
    if (status.includes("TERLAMBAT")) return "terlambat";
    if (status.includes("TEPAT") || status.includes("SELESAI")) return "selesai";
    return "progress";
};

const parsePicSources = (workbook: xlsx.WorkBook): Map<string, PicSource> => {
    const map = new Map<string, PicSource>();
    for (const row of readRows(workbook, "InputPIC")) {
        const nomorUlok = normalizeKey(row.Kode_Ulok);
        if (!nomorUlok) continue;
        map.set(nomorUlok, {
            nomor_ulok: nomorUlok,
            nama_toko: nullableText(row.Nama_Toko),
            lingkup_pekerjaan: nullableText(row["Lingkup Pekerjaan"]),
            kategori_lokasi: nullableText(row.Kategori_Lokasi),
            tanggal_mulai_spk: excelDateToDateOnly(row.Tanggal_Mulai_SPK),
            plc_building_support: nullableText(row.PIC_Building_Support),
            spk_url: nullableText(row.SPK_URL),
            rab_url: nullableText(row.RAB_URL)
        });
    }
    return map;
};

const parseHRows = (workbook: xlsx.WorkBook): HRowSource[] => {
    const rows: HRowSource[] = [];
    for (const sheetName of workbook.SheetNames) {
        const match = sheetName.match(/^DataH(\d+)$/i);
        if (!match) continue;
        const hDay = Number(match[1]);
        if (!Number.isFinite(hDay)) continue;

        readRows(workbook, sheetName).forEach((row, index) => {
            const nomorUlok = normalizeKey(row.Kode_Ulok);
            if (!nomorUlok) return;

            const progress: HRowSource["progress"] = [];
            for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
                const status = nullableText(row[`Status_Progress${ordinal}`]);
                const catatan = nullableText(row[`Catatan${ordinal}`]);
                if (!status && !catatan) continue;
                progress.push({ status, catatan, ordinal });
            }

            rows.push({
                sheet_name: sheetName,
                h_day: hDay,
                row_number: index + 2,
                nomor_ulok: nomorUlok,
                status_lokasi: nullableText(row.Status_Lokasi),
                progress,
                link_pdf: nullableText(row.Link_PDF)
            });
        });
    }
    return rows;
};

const parseWorkbook = (buffer: Buffer): { pics: Map<string, PicSource>; hRows: HRowSource[] } => {
    if (!buffer.length) throw new AppError("File Excel wajib diupload", 400);
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    if (!workbook.Sheets.InputPIC) {
        throw new AppError("Format file tidak dikenali. Sheet InputPIC tidak ditemukan.", 400);
    }
    if (!workbook.SheetNames.some((sheet) => /^DataH\d+$/i.test(sheet))) {
        throw new AppError("Format file tidak dikenali. Sheet DataH tidak ditemukan.", 400);
    }
    return { pics: parsePicSources(workbook), hRows: parseHRows(workbook) };
};

const findTargetsByUlok = async (nomorUloks: string[]): Promise<Map<string, TargetContext[]>> => {
    const map = new Map<string, TargetContext[]>();
    if (nomorUloks.length === 0) return map;

    const result = await pool.query<TargetContext>(
        `
        SELECT
            t.id AS toko_id,
            t.nomor_ulok,
            COALESCE(t.lingkup_pekerjaan, '') AS lingkup_pekerjaan,
            t.nama_toko,
            t.cabang,
            g.id AS gantt_id,
            r.id AS rab_id,
            s.id AS spk_id,
            COALESCE(r.kategori_lokasi, '') AS kategori_lokasi,
            CASE
                WHEN s.durasi IS NOT NULL THEN concat(s.durasi::text, ' Hari')
                WHEN r.durasi_pekerjaan IS NOT NULL THEN concat(r.durasi_pekerjaan::text, ' Hari')
                ELSE NULL
            END AS durasi,
            COALESCE(s.waktu_mulai::date::text, NULL) AS tanggal_mulai_spk,
            pic.id AS existing_pic_id,
            NULL::int AS pengawasan_gantt_id,
            0::int AS existing_pengawasan_count,
            NULL::text AS existing_pdf_link
        FROM toko t
        LEFT JOIN LATERAL (
            SELECT id
            FROM gantt_chart
            WHERE id_toko = t.id
            ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id DESC
            LIMIT 1
        ) g ON TRUE
        LEFT JOIN LATERAL (
            SELECT id, kategori_lokasi, durasi_pekerjaan
            FROM rab
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) r ON TRUE
        LEFT JOIN LATERAL (
            SELECT id, durasi, waktu_mulai
            FROM pengajuan_spk
            WHERE id_toko = t.id
            ORDER BY CASE WHEN status = 'SPK_APPROVED' THEN 0 ELSE 1 END, id DESC
            LIMIT 1
        ) s ON TRUE
        LEFT JOIN LATERAL (
            SELECT id
            FROM pic_pengawasan
            WHERE id_toko = t.id
            ORDER BY id DESC
            LIMIT 1
        ) pic ON TRUE
        WHERE UPPER(t.nomor_ulok) = ANY($1::text[])
        ORDER BY t.nomor_ulok ASC, t.id ASC
        `,
        [nomorUloks]
    );

    for (const row of result.rows) {
        const key = normalizeKey(row.nomor_ulok);
        const rows = map.get(key) ?? [];
        rows.push(row);
        map.set(key, rows);
    }
    return map;
};

const hydrateExistingForDate = async (target: TargetContext, tanggalPengawasan: string): Promise<TargetContext> => {
    if (!target.gantt_id) return target;
    const result = await pool.query<{
        pengawasan_gantt_id: number | null;
        existing_pengawasan_count: string | number | null;
        existing_pdf_link: string | null;
    }>(
        `
        SELECT
            pg.id AS pengawasan_gantt_id,
            COUNT(p.id) AS existing_pengawasan_count,
            MAX(bp.link_pdf_pengawasan) AS existing_pdf_link
        FROM pengawasan_gantt pg
        LEFT JOIN pengawasan p ON p.id_pengawasan_gantt = pg.id
        LEFT JOIN berkas_pengawasan bp ON bp.id_pengawasan_gantt = pg.id
        WHERE pg.id_gantt = $1
          AND pg.tanggal_pengawasan = $2
        GROUP BY pg.id
        ORDER BY pg.id ASC
        LIMIT 1
        `,
        [target.gantt_id, tanggalPengawasan]
    );

    const row = result.rows[0];
    if (!row) return target;
    return {
        ...target,
        pengawasan_gantt_id: row.pengawasan_gantt_id,
        existing_pengawasan_count: Number(row.existing_pengawasan_count ?? 0),
        existing_pdf_link: row.existing_pdf_link
    };
};

const findPekerjaanForHDay = async (
    target: TargetContext,
    hDay: number,
    progress: HRowSource["progress"]
): Promise<WorkItem["pekerjaan"]> => {
    if (!target.gantt_id || !target.rab_id) return [];
    const result = await pool.query<{ kategori_pekerjaan: string; jenis_pekerjaan: string }>(
        `
        WITH scheduled AS (
            SELECT DISTINCT k.kategori_pekerjaan, d.id AS day_id
            FROM day_gantt_chart d
            JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
            WHERE d.id_gantt = $1
              AND NULLIF(regexp_replace(COALESCE(d.h_awal, ''), '[^0-9]', '', 'g'), '')::int <= $2
              AND NULLIF(regexp_replace(COALESCE(d.h_akhir, ''), '[^0-9]', '', 'g'), '')::int >= $2
        )
        SELECT s.kategori_pekerjaan, ri.jenis_pekerjaan
        FROM scheduled s
        JOIN rab_item ri
          ON ri.id_rab = $3
         AND UPPER(ri.kategori_pekerjaan) = UPPER(s.kategori_pekerjaan)
        ORDER BY s.day_id ASC, ri.id ASC
        LIMIT $4
        `,
        [target.gantt_id, hDay, target.rab_id, Math.max(progress.length, 1)]
    );

    return result.rows.map((row, index) => ({
        kategori_pekerjaan: row.kategori_pekerjaan,
        jenis_pekerjaan: row.jenis_pekerjaan,
        catatan: progress[index]?.catatan ?? null,
        status: mapPengawasanStatus(progress[index]?.status ?? null)
    }));
};

const buildWorkItems = async (buffer: Buffer): Promise<WorkItem[]> => {
    const { pics, hRows } = parseWorkbook(buffer);
    const targetsByUlok = await findTargetsByUlok([...new Set(hRows.map((row) => row.nomor_ulok))]);
    const items: WorkItem[] = [];

    let expandedIndex = 0;
    for (const source of hRows) {
        const pic = pics.get(source.nomor_ulok) ?? null;
        const allowedScopes = normalizeLingkup(pic?.lingkup_pekerjaan);
        const baseTargets = targetsByUlok.get(source.nomor_ulok) ?? [];
        const filteredTargets = allowedScopes.length === 0
            ? baseTargets
            : baseTargets.filter((target) => allowedScopes.includes(normalizeKey(target.lingkup_pekerjaan)));

        const targetList = filteredTargets.length > 0 ? filteredTargets : [null];
        for (const rawTarget of targetList) {
            expandedIndex += 1;
            const issues: string[] = [];
            const warnings: string[] = [];
            let target = rawTarget;

            const startDate = pic?.tanggal_mulai_spk ?? target?.tanggal_mulai_spk ?? null;
            const tanggalPengawasan = startDate ? addDaysToDate(startDate, source.h_day - 1) : null;
            if (!pic) warnings.push("InputPIC tidak ditemukan untuk ULOK ini");
            if (!source.link_pdf) warnings.push("Link PDF pengawasan kosong");
            if (source.progress.length === 0) issues.push("Status/Catatan progress kosong");
            if (!startDate) issues.push("Tanggal mulai SPK tidak ditemukan");
            if (!tanggalPengawasan) issues.push("Tanggal pengawasan tidak bisa dihitung");
            if (!target) issues.push("Toko target tidak ditemukan di DB untuk ULOK ini");

            if (target && tanggalPengawasan) {
                target = await hydrateExistingForDate(target, tanggalPengawasan);
                if (!target.gantt_id) issues.push("Gantt target tidak ditemukan");
                if (!target.rab_id) issues.push("RAB target tidak ditemukan");
                if (!target.spk_id) issues.push("SPK target tidak ditemukan");
            }

            const pekerjaan = target
                ? await findPekerjaanForHDay(target, source.h_day, source.progress)
                : [];
            if (target && source.progress.length > 0 && pekerjaan.length === 0) {
                issues.push(`Item pekerjaan Gantt/RAB untuk H${source.h_day} tidak ditemukan`);
            }
            if (target && pekerjaan.length > 0 && pekerjaan.length < source.progress.length) {
                warnings.push(`Progress Excel ${source.progress.length}, item pekerjaan termapping ${pekerjaan.length}`);
            }

            items.push({
                source_pengawasan_id: 400000 + expandedIndex,
                source,
                pic,
                target,
                tanggal_pengawasan: tanggalPengawasan,
                pekerjaan,
                issues,
                warnings
            });
        }
    }

    return items;
};

const ensurePicPengawasan = async (client: PoolClient, item: WorkItem): Promise<number | null> => {
    const target = item.target;
    if (!target || !item.pic || !target.rab_id || !target.spk_id) return target?.existing_pic_id ?? null;
    if (target.existing_pic_id) return target.existing_pic_id;

    const result = await client.query<{ id: number }>(
        `
        INSERT INTO pic_pengawasan (
            id_toko, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk, plc_building_support
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
        RETURNING id
        `,
        [
            target.toko_id,
            target.nomor_ulok,
            target.rab_id,
            target.spk_id,
            item.pic.kategori_lokasi ?? target.kategori_lokasi ?? "-",
            target.durasi ?? "-",
            item.pic.tanggal_mulai_spk ?? target.tanggal_mulai_spk,
            item.pic.plc_building_support ?? "-"
        ]
    );
    return result.rows[0].id;
};

const ensurePengawasanGantt = async (
    client: PoolClient,
    item: WorkItem,
    idPicPengawasan: number | null
): Promise<number> => {
    if (!item.target?.gantt_id || !item.tanggal_pengawasan) {
        throw new AppError(`Target/tanggal source ${item.source_pengawasan_id} tidak valid`, 422);
    }

    const existing = await client.query<{ id: number }>(
        `
        SELECT id
        FROM pengawasan_gantt
        WHERE id_gantt = $1 AND tanggal_pengawasan = $2
        ORDER BY id ASC
        LIMIT 1
        `,
        [item.target.gantt_id, item.tanggal_pengawasan]
    );
    if (existing.rows[0]) {
        await client.query(
            `
            UPDATE pengawasan_gantt
            SET id_pic_pengawasan = COALESCE($1, id_pic_pengawasan)
            WHERE id = $2
            `,
            [idPicPengawasan, existing.rows[0].id]
        );
        return existing.rows[0].id;
    }

    const inserted = await client.query<{ id: number }>(
        `
        INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan, id_pic_pengawasan)
        VALUES ($1, $2, $3)
        RETURNING id
        `,
        [item.target.gantt_id, item.tanggal_pengawasan, idPicPengawasan]
    );
    return inserted.rows[0].id;
};

const upsertBerkasPengawasan = async (client: PoolClient, idPengawasanGantt: number, linkPdf: string | null): Promise<void> => {
    if (!linkPdf) return;
    await client.query(
        `
        INSERT INTO berkas_pengawasan (id_pengawasan_gantt, link_pdf_pengawasan)
        VALUES ($1, $2)
        ON CONFLICT (id_pengawasan_gantt)
        DO UPDATE SET link_pdf_pengawasan = EXCLUDED.link_pdf_pengawasan
        `,
        [idPengawasanGantt, linkPdf]
    );
};

const insertPengawasanItems = async (client: PoolClient, item: WorkItem, idPengawasanGantt: number): Promise<number> => {
    if (!item.target?.gantt_id) return 0;
    let count = 0;
    for (const pekerjaan of item.pekerjaan) {
        await client.query(
            `
            INSERT INTO pengawasan (
                id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, dokumentasi_base64, status
            ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
            `,
            [
                item.target.gantt_id,
                idPengawasanGantt,
                pekerjaan.kategori_pekerjaan,
                pekerjaan.jenis_pekerjaan,
                pekerjaan.catatan,
                pekerjaan.status
            ]
        );
        count += 1;
    }
    return count;
};

const applyWorkItem = async (
    client: PoolClient,
    item: WorkItem,
    action: PengawasanMigrationAction
) => {
    if (action === "skip") {
        return { action, source_pengawasan_id: item.source_pengawasan_id, status: "skipped", inserted_items: 0, target_pengawasan_gantt_id: null };
    }
    if (item.issues.length > 0) {
        throw new AppError(`Pengawasan source ${item.source_pengawasan_id} tidak valid: ${item.issues.join(", ")}`, 422);
    }
    if (!item.target) throw new AppError(`Target source ${item.source_pengawasan_id} tidak ditemukan`, 404);
    if (action === "insert" && (item.target.existing_pengawasan_count > 0 || item.target.existing_pdf_link)) {
        throw new AppError(`Pengawasan ${item.source.nomor_ulok} H${item.source.h_day} sudah ada. Pilih replace/update PDF atau skip.`, 409);
    }
    if ((action === "replace_pengawasan" || action === "update_pdf") && !item.target.pengawasan_gantt_id && action === "update_pdf") {
        throw new AppError(`Berkas pengawasan existing untuk source ${item.source_pengawasan_id} belum ada. Gunakan insert/replace.`, 404);
    }

    const idPic = await ensurePicPengawasan(client, item);
    const idPengawasanGantt = await ensurePengawasanGantt(client, item, idPic);

    if (action === "update_pdf") {
        await upsertBerkasPengawasan(client, idPengawasanGantt, item.source.link_pdf);
        return { action, source_pengawasan_id: item.source_pengawasan_id, status: "updated_pdf", inserted_items: 0, target_pengawasan_gantt_id: idPengawasanGantt };
    }

    if (action === "replace_pengawasan") {
        await client.query(`DELETE FROM pengawasan WHERE id_pengawasan_gantt = $1`, [idPengawasanGantt]);
    }

    const insertedItems = await insertPengawasanItems(client, item, idPengawasanGantt);
    await upsertBerkasPengawasan(client, idPengawasanGantt, item.source.link_pdf);
    return {
        action,
        source_pengawasan_id: item.source_pengawasan_id,
        status: action === "replace_pengawasan" ? "replaced" : "inserted",
        inserted_items: insertedItems,
        target_pengawasan_gantt_id: idPengawasanGantt
    };
};

export const pengawasanMigrationService = {
    async preview(buffer: Buffer, actorRole: string) {
        if (!hasSuperHumanRole(actorRole)) {
            throw new AppError("Hanya Super Human yang dapat melakukan migrasi Pengawasan", 403);
        }

        const items = await buildWorkItems(buffer);
        let readyCount = 0;
        let conflictCount = 0;
        let invalidCount = 0;
        let missingTargetCount = 0;
        let totalPengawasanItems = 0;

        const details = items.map((item) => {
            const state = item.issues.length > 0
                ? "invalid"
                : item.target && (item.target.existing_pengawasan_count > 0 || item.target.existing_pdf_link)
                    ? "conflict"
                    : "ready";
            if (state === "ready") readyCount += 1;
            if (state === "conflict") conflictCount += 1;
            if (state === "invalid") invalidCount += 1;
            if (!item.target) missingTargetCount += 1;
            totalPengawasanItems += item.pekerjaan.length;

            return {
                source_pengawasan_id: item.source_pengawasan_id,
                sheet_name: item.source.sheet_name,
                row_number: item.source.row_number,
                h_day: item.source.h_day,
                nomor_ulok: item.source.nomor_ulok,
                lingkup_pekerjaan: item.target?.lingkup_pekerjaan ?? "",
                nama_toko: item.target?.nama_toko ?? item.pic?.nama_toko ?? "",
                cabang: item.target?.cabang ?? "",
                tanggal_mulai_spk: item.pic?.tanggal_mulai_spk ?? item.target?.tanggal_mulai_spk ?? "",
                tanggal_pengawasan: item.tanggal_pengawasan ?? "",
                pic_building_support: item.pic?.plc_building_support ?? "",
                status_lokasi: item.source.status_lokasi ?? "",
                link_pdf: item.source.link_pdf ?? "",
                mapped_item_count: item.pekerjaan.length,
                existing_pic_id: item.target?.existing_pic_id ?? null,
                existing_pengawasan_gantt_id: item.target?.pengawasan_gantt_id ?? null,
                existing_pengawasan_count: item.target?.existing_pengawasan_count ?? 0,
                existing_pdf_link: item.target?.existing_pdf_link ?? null,
                db_state: state,
                issues: item.issues,
                warnings: item.warnings
            };
        });

        return {
            total_pengawasan: items.length,
            total_item_pengawasan: totalPengawasanItems,
            ready_count: readyCount,
            conflict_count: conflictCount,
            invalid_count: invalidCount,
            missing_target_count: missingTargetCount,
            details
        };
    },

    async commit(buffer: Buffer, input: PengawasanMigrationCommitInput) {
        if (!hasSuperHumanRole(input.actor_role)) {
            throw new AppError("Hanya Super Human yang dapat melakukan migrasi Pengawasan", 403);
        }

        const items = await buildWorkItems(buffer);
        const itemById = new Map(items.map((item) => [item.source_pengawasan_id, item]));
        const selected = input.selections.filter((selection) => selection.action !== "skip");

        const results = await withTransaction(async (client) => {
            const rowResults = [];
            for (const selection of input.selections) {
                const item = itemById.get(selection.source_pengawasan_id);
                if (!item) {
                    throw new AppError(`source_pengawasan_id ${selection.source_pengawasan_id} tidak ditemukan di file`, 404);
                }
                rowResults.push(await applyWorkItem(client, item, selection.action));
            }

            await activityLogRepository.insert({
                entity_type: "PENGAWASAN",
                entity_id: 0,
                actor_email: input.actor_email ?? null,
                actor_role: input.actor_role,
                action: "SUPER_HUMAN_MIGRATION",
                status_before: null,
                status_after: "MIGRATION_COMMITTED",
                reason: "Migrasi Pengawasan dari file PENGAWASAN",
                metadata: {
                    total_selected: input.selections.length,
                    total_executed: selected.length,
                    source_pengawasan_ids: input.selections.map((selection) => selection.source_pengawasan_id)
                }
            }, client);

            return rowResults;
        });

        return {
            total_selected: input.selections.length,
            inserted: results.filter((row) => row.status === "inserted").length,
            replaced: results.filter((row) => row.status === "replaced").length,
            updated_pdf: results.filter((row) => row.status === "updated_pdf").length,
            skipped: results.filter((row) => row.status === "skipped").length,
            inserted_items: results.reduce((sum, row) => sum + row.inserted_items, 0),
            details: results
        };
    }
};
