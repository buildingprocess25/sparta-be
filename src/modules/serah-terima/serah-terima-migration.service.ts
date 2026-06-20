import * as xlsx from "xlsx";
import type { PoolClient } from "pg";
import { AppError } from "../../common/app-error";
import { pool, withTransaction } from "../../db/pool";
import { activityLogRepository } from "../activity-log/activity-log.repository";
import { opnameFinalService } from "../opname-final/opname-final.service";
import type {
    SerahTerimaMigrationAction,
    SerahTerimaMigrationCommitInput
} from "./serah-terima-migration.schema";

type CellRow = Record<string, unknown>;
type SourceAttempt = {
    source_row: number;
    nomor_ulok: string;
    cabang: string;
    status: string;
    timestamp: string;
    created_at: string | null;
    link_pdf: string | null;
    tanggal_berikutnya: string | null;
    checklist_count: number;
};
type Candidate = SourceAttempt & {
    source_candidate_id: number;
    toko_id: number | null;
    lingkup_pekerjaan: string;
    nama_toko: string | null;
    existing_id: number | null;
    existing_link_pdf: string | null;
    existing_created_at: string | null;
    issues: string[];
    warnings: string[];
};

const hasSuperHumanRole = (role: string) => role.toUpperCase().includes("SUPER HUMAN");
const text = (value: unknown) => String(value ?? "").trim();
const key = (value: unknown) => text(value).toUpperCase().replace(/\s+/g, " ");
const parseTimestamp = (value: unknown): string | null => {
    const raw = text(value);
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")} ${match[4].padStart(2, "0")}:${match[5]}:${match[6]}`;
};

const parseWorkbook = (buffer: Buffer): { accepted: SourceAttempt[]; rejectedOnly: SourceAttempt[] } => {
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false });
    if (!workbook.Sheets.SerahTerima) throw new AppError("Sheet SerahTerima tidak ditemukan", 400);
    const rows = xlsx.utils.sheet_to_json<CellRow>(workbook.Sheets.SerahTerima, { defval: null, raw: false });
    const attemptsByUlok = new Map<string, SourceAttempt[]>();
    rows.forEach((row, index) => {
        const nomorUlok = key(row.Kode_Ulok);
        if (!nomorUlok) return;
        const attempt: SourceAttempt = {
            source_row: index + 2,
            nomor_ulok: nomorUlok,
            cabang: text(row.Cabang),
            status: key(row.Status_Serah_Terima),
            timestamp: text(row.Timestamp),
            created_at: parseTimestamp(row.Timestamp),
            link_pdf: text(row.Link_PDF) || null,
            tanggal_berikutnya: text(row.Tanggal_Serah_Terima_Berikutnya) || null,
            checklist_count: Object.entries(row).filter(([column, value]) =>
                column.endsWith("_items_area") && text(value)
            ).length
        };
        attemptsByUlok.set(nomorUlok, [...(attemptsByUlok.get(nomorUlok) ?? []), attempt]);
    });

    const accepted: SourceAttempt[] = [];
    const rejectedOnly: SourceAttempt[] = [];
    for (const attempts of attemptsByUlok.values()) {
        const ordered = [...attempts].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        const acceptedAttempts = ordered.filter((attempt) => attempt.status === "DITERIMA");
        if (acceptedAttempts.length > 0) accepted.push(acceptedAttempts.at(-1)!);
        else rejectedOnly.push(ordered.at(-1)!);
    }
    return { accepted, rejectedOnly };
};

const resolveCandidates = async (buffer: Buffer): Promise<Candidate[]> => {
    const sources = parseWorkbook(buffer);
    const allUloks = [...new Set([...sources.accepted, ...sources.rejectedOnly].map((row) => row.nomor_ulok))];
    const targetResult = await pool.query<{
        toko_id: number;
        nomor_ulok: string;
        lingkup_pekerjaan: string;
        nama_toko: string;
        cabang: string;
        existing_id: number | null;
        existing_link_pdf: string | null;
        existing_created_at: string | null;
    }>(`
        SELECT
            t.id AS toko_id, t.nomor_ulok, t.lingkup_pekerjaan, t.nama_toko, t.cabang,
            existing.id AS existing_id,
            existing.link_pdf AS existing_link_pdf,
            existing.created_at::text AS existing_created_at
        FROM toko t
        LEFT JOIN LATERAL (
            SELECT id, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = t.id
            ORDER BY id DESC LIMIT 1
        ) existing ON TRUE
        WHERE UPPER(t.nomor_ulok) = ANY($1::text[])
        ORDER BY t.nomor_ulok, t.id
    `, [allUloks]);
    const targetsByUlok = new Map<string, typeof targetResult.rows>();
    targetResult.rows.forEach((row) => {
        const ulok = key(row.nomor_ulok);
        targetsByUlok.set(ulok, [...(targetsByUlok.get(ulok) ?? []), row]);
    });

    let candidateId = 800000;
    const candidates: Candidate[] = [];
    for (const source of sources.accepted) {
        const targets = targetsByUlok.get(source.nomor_ulok) ?? [];
        if (targets.length === 0) {
            candidateId += 1;
            candidates.push({
                ...source,
                source_candidate_id: candidateId,
                toko_id: null,
                lingkup_pekerjaan: "",
                nama_toko: null,
                existing_id: null,
                existing_link_pdf: null,
                existing_created_at: null,
                issues: ["Toko ULOK tidak ditemukan di database"],
                warnings: []
            });
            continue;
        }
        for (const target of targets) {
            candidateId += 1;
            const warnings: string[] = [];
            if (!source.link_pdf) warnings.push("Link PDF Serah Terima kosong");
            if (source.checklist_count === 0) warnings.push("Checklist detail kosong di sheet; PDF lama tetap digunakan");
            candidates.push({
                ...source,
                source_candidate_id: candidateId,
                toko_id: target.toko_id,
                lingkup_pekerjaan: target.lingkup_pekerjaan,
                nama_toko: target.nama_toko,
                cabang: target.cabang || source.cabang,
                existing_id: target.existing_id,
                existing_link_pdf: target.existing_link_pdf,
                existing_created_at: target.existing_created_at,
                issues: source.link_pdf ? [] : ["Dokumen DITERIMA tidak memiliki link PDF"],
                warnings
            });
        }
    }
    for (const source of sources.rejectedOnly) {
        candidateId += 1;
        candidates.push({
            ...source,
            source_candidate_id: candidateId,
            toko_id: null,
            lingkup_pekerjaan: "",
            nama_toko: null,
            existing_id: null,
            existing_link_pdf: null,
            existing_created_at: null,
            issues: ["Belum memiliki pengajuan Serah Terima berstatus DITERIMA"],
            warnings: source.tanggal_berikutnya ? [`Jadwal berikutnya: ${source.tanggal_berikutnya}`] : []
        });
    }
    return candidates;
};

const writeCandidate = async (
    client: PoolClient,
    candidate: Candidate,
    action: SerahTerimaMigrationAction
) => {
    if (action === "skip") return { status: "skipped", source_candidate_id: candidate.source_candidate_id, id_toko: candidate.toko_id };
    if (candidate.issues.length > 0 || !candidate.toko_id || !candidate.link_pdf || !candidate.created_at) {
        throw new AppError(`Serah Terima ${candidate.nomor_ulok} tidak valid: ${candidate.issues.join(", ")}`, 422);
    }
    if (action === "insert" && candidate.existing_id) throw new AppError(`Serah Terima ${candidate.nomor_ulok}/${candidate.lingkup_pekerjaan} sudah ada`, 409);
    if (action === "replace" && !candidate.existing_id) throw new AppError(`Serah Terima existing ${candidate.nomor_ulok}/${candidate.lingkup_pekerjaan} tidak ditemukan`, 404);
    if (action === "replace") {
        await client.query(`
            UPDATE berkas_serah_terima
            SET link_pdf = $1, created_at = $2::timestamp
            WHERE id = $3
        `, [candidate.link_pdf, candidate.created_at, candidate.existing_id]);
        return { status: "replaced", source_candidate_id: candidate.source_candidate_id, id_toko: candidate.toko_id };
    }
    await client.query(`
        INSERT INTO berkas_serah_terima (id_toko, link_pdf, created_at)
        VALUES ($1, $2, $3::timestamp)
    `, [candidate.toko_id, candidate.link_pdf, candidate.created_at]);
    return { status: "inserted", source_candidate_id: candidate.source_candidate_id, id_toko: candidate.toko_id };
};

export const serahTerimaMigrationService = {
    async preview(buffer: Buffer, actorRole: string) {
        if (!hasSuperHumanRole(actorRole)) throw new AppError("Hanya Super Human yang dapat melakukan migrasi Serah Terima", 403);
        const candidates = await resolveCandidates(buffer);
        const details = candidates.map((candidate) => ({
            source_candidate_id: candidate.source_candidate_id,
            source_row: candidate.source_row,
            nomor_ulok: candidate.nomor_ulok,
            lingkup_pekerjaan: candidate.lingkup_pekerjaan,
            nama_toko: candidate.nama_toko,
            cabang: candidate.cabang,
            status_serah_terima: candidate.status,
            created_at: candidate.created_at,
            link_pdf: candidate.link_pdf,
            checklist_count: candidate.checklist_count,
            existing_id: candidate.existing_id,
            existing_link_pdf: candidate.existing_link_pdf,
            db_state: candidate.issues.length > 0 ? "invalid" : candidate.existing_id ? "conflict" : "ready",
            issues: candidate.issues,
            warnings: candidate.warnings
        }));
        return {
            total_candidates: details.length,
            total_ulok: new Set(details.map((row) => row.nomor_ulok)).size,
            ready_count: details.filter((row) => row.db_state === "ready").length,
            conflict_count: details.filter((row) => row.db_state === "conflict").length,
            invalid_count: details.filter((row) => row.db_state === "invalid").length,
            details
        };
    },

    async commit(buffer: Buffer, input: SerahTerimaMigrationCommitInput) {
        if (!hasSuperHumanRole(input.actor_role)) throw new AppError("Hanya Super Human yang dapat melakukan migrasi Serah Terima", 403);
        const candidates = await resolveCandidates(buffer);
        const byId = new Map(candidates.map((candidate) => [candidate.source_candidate_id, candidate]));
        const results = await withTransaction(async (client) => {
            const rows = [];
            for (const selection of input.selections) {
                const candidate = byId.get(selection.source_candidate_id);
                if (!candidate) throw new AppError(`Kandidat ${selection.source_candidate_id} tidak ditemukan`, 404);
                rows.push(await writeCandidate(client, candidate, selection.action));
            }
            await activityLogRepository.insert({
                entity_type: "BERKAS_SERAH_TERIMA",
                entity_id: 0,
                actor_email: input.actor_email ?? null,
                actor_role: input.actor_role,
                action: "SUPER_HUMAN_MIGRATION",
                status_after: "MIGRATION_COMMITTED",
                reason: "Migrasi Serah Terima dari PENGAWASAN.xlsx",
                metadata: { total_selected: input.selections.length }
            }, client);
            return rows;
        });

        const syncWarnings: string[] = [];
        for (const idToko of [...new Set(results.filter((row) => row.status !== "skipped" && row.id_toko).map((row) => row.id_toko!))]) {
            try {
                await opnameFinalService.refreshDendaByTokoId(idToko);
            } catch (error) {
                syncWarnings.push(`${idToko}: ${error instanceof Error ? error.message : "sinkronisasi denda gagal"}`);
            }
        }
        return {
            total_selected: input.selections.length,
            inserted: results.filter((row) => row.status === "inserted").length,
            replaced: results.filter((row) => row.status === "replaced").length,
            skipped: results.filter((row) => row.status === "skipped").length,
            sync_warnings: syncWarnings,
            details: results
        };
    }
};
