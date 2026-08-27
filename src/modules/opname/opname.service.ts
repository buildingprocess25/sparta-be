import { AppError } from "../../common/app-error";
import { pool, withTransaction } from "../../db/pool";
import type { PoolClient } from "pg";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { calculateDendaByTokoId } from "../denda/denda-keterlambatan";
import { instruksiLapanganRepository } from "../instruksi-lapangan/instruksi-lapangan.repository";
import { opnameFinalRepository } from "../opname-final/opname-final.repository";
import { scheduleAutomaticSerahTerimaIfReady } from "../serah-terima/serah-terima.service";
import { scheduleAutomaticUnifiedSerahTerimaIfReady } from "../serah-terima/serah-terima.service";
import { subtractOneCalendarDay, workItemKey } from "./opname-checkpoint.rules";
import { opnameRepository, type OpnameRow, type TokoSummaryRow } from "./opname.repository";
import type {
    ContractorCheckpointOpnameSubmitInput,
    ContractorOpnameRevisionInput,
    CreateBulkOpnameItemData,
    CreateBulkOpnameItemInput,
    CreateOpnameData,
    CreateOpnameInput,
    ListOpnameQueryInput,
    SupportOpnameReviewDecisionInput,
    UpdateOpnameInput
} from "./opname.schema";
type UploadedFotoOpnameFile = {
    originalname: string;
    mimetype: string;
    buffer: Parameters<GoogleProvider["uploadFile"]>[3];
};

type PgError = {
    code?: string;
    constraint?: string;
};

const toPgError = (error: unknown): PgError => {
    if (typeof error === "object" && error !== null) {
        return error as PgError;
    }

    return {};
};

const mapPgError = (error: unknown): never => {
    const pgError = toPgError(error);

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_toko") {
        throw new AppError("id_toko tidak ditemukan di tabel toko", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_rab_item") {
        throw new AppError("id_rab_item tidak ditemukan di tabel rab_item", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_instruksi_lapangan_item") {
        throw new AppError("id_instruksi_lapangan_item tidak ditemukan di tabel instruksi_lapangan_item", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_opname_final") {
        throw new AppError("id_opname_final tidak ditemukan di tabel opname_final", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_opname_item_status") {
        throw new AppError("status opname tidak valid (gunakan: pending, disetujui, ditolak)", 400);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_opname_item_source") {
        throw new AppError("Sumber item opname tidak valid. Isi tepat salah satu: id_rab_item atau id_instruksi_lapangan_item", 400);
    }

    throw error;
};

const parseOpnameId = (id: string): number => {
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new AppError("Parameter id harus berupa integer positif", 400);
    }

    return parsedId;
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedFotoOpnameFile): string => {
    const fromName = (() => {
        const rawName = file.originalname ?? "";
        const lastDot = rawName.lastIndexOf(".");
        if (lastDot <= 0 || lastDot === rawName.length - 1) return "";
        return rawName.slice(lastDot).toLowerCase();
    })();

    if (/^\.[a-z0-9]{1,10}$/.test(fromName)) {
        return fromName;
    }

    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const extractDriveFileId = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const byIdParam = /[?&]id=([^&]+)/.exec(trimmed);
    if (byIdParam?.[1]) return byIdParam[1];

    const byPath = /\/d\/([^/]+)/.exec(trimmed);
    if (byPath?.[1]) return byPath[1];

    return null;
};

const normalizeDriveDownloadLink = (value?: string | null): string | undefined => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return undefined;

    const fileId = extractDriveFileId(trimmed);
    if (!fileId) return trimmed;

    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const inferFileExtension = (mimeType?: string | null): string => {
    const value = (mimeType ?? "").toLowerCase();
    if (value === "application/pdf") return ".pdf";
    if (value === "image/png") return ".png";
    if (value === "image/jpeg") return ".jpg";
    if (value === "image/webp") return ".webp";
    if (value === "image/svg+xml") return ".svg";
    return "";
};

const buildOpnameFotoDownloadPath = (
    opnameItemId: number | string,
    rawLink?: string | null,
): string | null => {
    const trimmed = (rawLink ?? "").trim();
    if (!trimmed) return null;

    return `/api/opname/${opnameItemId}/foto`;
};

const normalizeOpnameFotoLink = <T extends { id: number | string; foto: string | null }>(
    opnameItem: T,
): T => {
    return {
        ...opnameItem,
        foto: buildOpnameFotoDownloadPath(opnameItem.id, opnameItem.foto),
    };
};

export const uploadFotoOpnameToDrive = async (
    idToko: number,
    file: UploadedFotoOpnameFile
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;

    if (!drive) {
        throw new AppError("Google Drive belum terkonfigurasi", 500);
    }

    const safeToko = sanitizeFilenamePart(String(idToko), "toko");
    const ext = resolveFileExtension(file);
    const filename = `OPNAME_FOTO_${safeToko}_${Date.now()}${ext}`;

    const tokoQuery = await pool.query(
        `SELECT nomor_ulok, proyek FROM toko WHERE id = $1`,
        [idToko]
    );
    const nomorUlok = tokoQuery.rows[0]?.nomor_ulok;
    const proyek = tokoQuery.rows[0]?.proyek;

    const folderId = await gp.getOrCreateProcessFolder("Opname", nomorUlok);

    const result = await gp.uploadFile(
        folderId,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive
    );

    if (result.webViewLink) {
        return result.webViewLink;
    }

    if (result.id) {
        return `https://drive.google.com/file/d/${result.id}/view`;
    }

    throw new AppError("Upload foto opname ke Google Drive gagal", 500);
};

const refreshOpnameFinalDenda = async (opnameFinalId: number, idToko: number, existingClient?: PoolClient) => {
    const denda = await calculateDendaByTokoId(idToko);
    await opnameFinalRepository.updateDenda(String(opnameFinalId), denda, existingClient);
    return denda;
};

const normalizeActorRoles = (actor?: AuthenticatedUser | null): string[] =>
    (actor?.roles?.length ? actor.roles : [actor?.jabatan])
        .map((role) => String(role ?? "").trim().toUpperCase())
        .filter(Boolean);

const actorEmail = (actor?: AuthenticatedUser | null, fallback?: string | null): string => {
    const email = actor?.email_sat || fallback;
    if (!email) throw new AppError("User belum terautentikasi", 401);
    return email;
};

const assertContractorActor = (actor?: AuthenticatedUser | null): void => {
    const roles = normalizeActorRoles(actor);
    const isContractor = roles.some((role) => role.includes("KONTRAKTOR") || role.includes("DIREKTUR"));
    if (!isContractor) throw new AppError("Hanya kontraktor yang dapat mengisi atau merevisi opname.", 403);
};

const assertSupportActor = (actor?: AuthenticatedUser | null): void => {
    const roles = normalizeActorRoles(actor);
    const isSupport = roles.some((role) => role.includes("BRANCH BUILDING SUPPORT") || role.includes("SUPER HUMAN"));
    if (!isSupport) throw new AppError("Hanya Branch Building Support yang dapat mereview opname kontraktor.", 403);
};

const ddMmYyyyToIso = (value: string): string => {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const [dd, mm, yyyy] = trimmed.split("/");
    if (!dd || !mm || !yyyy) throw new AppError("Format tanggal pengawasan tidak valid", 500);
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

const assertNoDuplicateOpnameSources = (items: Array<{ id_rab_item?: number | null; id_instruksi_lapangan_item?: number | null }>): void => {
    const keys = new Set<string>();
    for (const item of items) {
        const key = workItemKey(item);
        if (keys.has(key)) throw new AppError(`Item opname duplikat: ${key}`, 400);
        keys.add(key);
    }
};

const sumOpnameTotal = (items: Array<{ total_harga_opname?: number | null }>): string =>
    String(items.reduce((total, item) => total + Number(item.total_harga_opname ?? 0), 0));
const mapBulkCreateResponse = (created: Awaited<ReturnType<typeof opnameRepository.createBulkWithFinal>>) => ({
    opname_final: {
        id: created.opnameFinal.id,
        id_toko: created.opnameFinal.id_toko,
        aksi: created.opnameFinal.aksi,
        status_opname_final: created.opnameFinal.status_opname_final
    },
    items: created.items.map((item) => normalizeOpnameFotoLink(item))
});

const finalizeBulkCreate = async (
    created: Awaited<ReturnType<typeof opnameRepository.createBulkWithFinal>>,
    existingClient?: PoolClient
) => {
    await refreshOpnameFinalDenda(created.opnameFinal.id, created.opnameFinal.id_toko, existingClient);
    await opnameFinalRepository.updateTotals(String(created.opnameFinal.id), existingClient);

    if (existingClient) {
        return mapBulkCreateResponse(created);
    }

    await scheduleAutomaticSerahTerimaIfReady(created.opnameFinal.id_toko, created.opnameFinal.created_at);

    // Trigger unified ST otomatis (SIPIL+ME) setelah semua pengawasan selesai dan opname masuk
    opnameRepository.findTokoById(created.opnameFinal.id_toko)
        .then((toko) => {
            if (toko?.nomor_ulok) {
                return scheduleAutomaticUnifiedSerahTerimaIfReady(toko.nomor_ulok);
            }
        })
        .catch((err) => {
            console.error("[AUTO ST UNIFIED]", err);
        });

    return mapBulkCreateResponse(created);
};
export const opnameService = {
    async create(
        input: CreateOpnameInput,
        uploadedFotoOpname?: UploadedFotoOpnameFile
    ): Promise<OpnameRow> {
        try {
            const fotoLink = uploadedFotoOpname
                ? await uploadFotoOpnameToDrive(input.id_toko, uploadedFotoOpname)
                : undefined;

            const payload: CreateOpnameData = fotoLink
                ? { ...input, foto: fotoLink }
                : input;

            const created = await opnameRepository.create(payload);
            await refreshOpnameFinalDenda(created.id_opname_final, created.id_toko);
            await opnameFinalRepository.updateTotals(String(created.id_opname_final));
            return normalizeOpnameFotoLink(created);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async createBulk(
        payload: {
            id_toko: number;
            tipe_opname?: string;
            email_pembuat: string;
            grand_total_opname: string;
            grand_total_rab: string;
            items: CreateBulkOpnameItemInput[];
        },
        uploadedFotoOpnameFiles: UploadedFotoOpnameFile[] = [],
        uploadedFotoOpnameIndexes?: number[],
        existingClient?: PoolClient
    ): Promise<{ opname_final: { id: number; id_toko: number; aksi: string; status_opname_final: string }; items: OpnameRow[] }> {
        try {
            const {
                id_toko: idToko,
                email_pembuat: emailPembuat,
                tipe_opname: tipeOpname,
                grand_total_opname: grandTotalOpname,
                grand_total_rab: grandTotalRab,
                items
            } = payload;

            if (uploadedFotoOpnameFiles.length === 0) {
                const created = await opnameRepository.createBulkWithFinal({
                    id_toko: idToko,
                    tipe_opname: tipeOpname,
                    email_pembuat: emailPembuat,
                    grand_total_opname: grandTotalOpname,
                    grand_total_rab: grandTotalRab,
                    items
                }, existingClient);

                return finalizeBulkCreate(created, existingClient);
            }

            if (uploadedFotoOpnameIndexes && uploadedFotoOpnameIndexes.length > 0) {
                if (uploadedFotoOpnameIndexes.length !== uploadedFotoOpnameFiles.length) {
                    throw new AppError(
                        "Jumlah file_foto_opname_indexes harus sama dengan jumlah file_foto_opname",
                        400
                    );
                }

                const usedIndexes = new Set<number>();
                const payloadWithFoto: CreateBulkOpnameItemData[] = items.map((item) => ({ ...item }));

                for (let filePosition = 0; filePosition < uploadedFotoOpnameFiles.length; filePosition++) {
                    const itemIndex = uploadedFotoOpnameIndexes[filePosition];
                    if (itemIndex < 0 || itemIndex >= items.length) {
                        throw new AppError(
                            `file_foto_opname_indexes[${filePosition}] di luar range items (0-${items.length - 1})`,
                            400
                        );
                    }

                    if (usedIndexes.has(itemIndex)) {
                        throw new AppError(
                            `file_foto_opname_indexes tidak boleh duplikat (duplikat di index item ${itemIndex})`,
                            400
                        );
                    }
                    usedIndexes.add(itemIndex);

                    const fotoLink = await uploadFotoOpnameToDrive(idToko, uploadedFotoOpnameFiles[filePosition]);
                    payloadWithFoto[itemIndex] = {
                        ...items[itemIndex],
                        foto: fotoLink
                    };
                }

                const created = await opnameRepository.createBulkWithFinal({
                    id_toko: idToko,
                    tipe_opname: tipeOpname,
                    email_pembuat: emailPembuat,
                    grand_total_opname: grandTotalOpname,
                    grand_total_rab: grandTotalRab,
                    items: payloadWithFoto
                }, existingClient);

                return finalizeBulkCreate(created, existingClient);
            }

            if (uploadedFotoOpnameFiles.length !== 1 && uploadedFotoOpnameFiles.length !== items.length) {
                throw new AppError(
                    "Jumlah file_foto_opname harus 1 file untuk semua item, sama dengan jumlah items, atau kirim file_foto_opname_indexes untuk mapping item tertentu",
                    400
                );
            }

            const payloadWithFoto: CreateBulkOpnameItemData[] = [];
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const file = uploadedFotoOpnameFiles.length === 1
                    ? uploadedFotoOpnameFiles[0]
                    : uploadedFotoOpnameFiles[index];

                if (!file) {
                    payloadWithFoto.push(item);
                    continue;
                }

                const fotoLink = await uploadFotoOpnameToDrive(idToko, file);
                payloadWithFoto.push({
                    ...item,
                    foto: fotoLink
                });
            }

            const created = await opnameRepository.createBulkWithFinal({
                id_toko: idToko,
                tipe_opname: tipeOpname,
                email_pembuat: emailPembuat,
                grand_total_opname: grandTotalOpname,
                grand_total_rab: grandTotalRab,
                items: payloadWithFoto
            }, existingClient);

            return finalizeBulkCreate(created, existingClient);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async submitContractorCheckpointOpname(
        input: ContractorCheckpointOpnameSubmitInput,
        actor?: AuthenticatedUser | null
    ): Promise<{
        id_pengawasan_gantt_target: number;
        tanggal_slot_opname: string;
        routed_to: "target_checkpoint" | "next_checkpoint" | "serah_terima";
        items: OpnameRow[];
    }> {
        assertContractorActor(actor);
        assertNoDuplicateOpnameSources(input.items);
        const emailPembuat = actorEmail(actor, input.email_pembuat);

        try {
            return await withTransaction(async (client) => {
                const checkpoint = await opnameRepository.findCheckpointForContractorOpname(input.id_pengawasan_gantt);
                if (!checkpoint) throw new AppError("Checkpoint pengawasan tidak ditemukan", 404);
                if (checkpoint.id_toko !== input.id_toko) {
                    throw new AppError("Checkpoint pengawasan tidak sesuai dengan toko yang dipilih", 400);
                }
                if (checkpoint.workflow_version !== "contractor_first") {
                    throw new AppError("Checkpoint ini masih memakai alur opname lama", 409);
                }

                const tanggalSlotOpname = subtractOneCalendarDay(ddMmYyyyToIso(checkpoint.tanggal_pengawasan));
                let targetId = checkpoint.id;
                let routedTo: "target_checkpoint" | "next_checkpoint" | "serah_terima" = "target_checkpoint";

                if (await opnameRepository.isCheckpointFilled(checkpoint.id)) {
                    const next = await opnameRepository.findNextUnfilledCheckpoint({
                        id_gantt: checkpoint.id_gantt,
                        after_tanggal_pengawasan: checkpoint.tanggal_pengawasan,
                    });
                    if (next) {
                        targetId = next.id;
                        routedTo = "next_checkpoint";
                    } else {
                        routedTo = "serah_terima";
                    }
                }

                const opnameFinal = await opnameRepository.findOrCreateContractorFirstFinal({
                    id_toko: input.id_toko,
                    email_pembuat: emailPembuat,
                    grand_total_opname: sumOpnameTotal(input.items),
                    grand_total_rab: sumOpnameTotal(input.items),
                    tipe_opname: "OPNAME",
                }, client);

                const items = await opnameRepository.createContractorFirstItems({
                    id_toko: input.id_toko,
                    id_opname_final: opnameFinal.id,
                    id_pengawasan_gantt_target: targetId,
                    tanggal_slot_opname: tanggalSlotOpname,
                    submitted_by_email: emailPembuat,
                    items: input.items,
                }, client);

                for (const item of items) {
                    await opnameRepository.insertRevisionHistory({
                        id_opname_item: item.id,
                        revision_no: item.revision_no,
                        previous_status: null,
                        next_status: item.status,
                        actor_email: emailPembuat,
                        actor_role: normalizeActorRoles(actor).join(", "),
                        snapshot: item,
                    }, client);
                }

                await refreshOpnameFinalDenda(opnameFinal.id, input.id_toko, client);
                await opnameFinalRepository.updateTotals(String(opnameFinal.id), client);

                return {
                    id_pengawasan_gantt_target: targetId,
                    tanggal_slot_opname: tanggalSlotOpname,
                    routed_to: routedTo,
                    items: items.map((item) => normalizeOpnameFotoLink(item)),
                };
            });
        } catch (error) {
            if (error instanceof AppError) throw error;
            return mapPgError(error);
        }
    },

    async reviewContractorFirstOpnameItem(
        id: string,
        input: SupportOpnameReviewDecisionInput,
        actor?: AuthenticatedUser | null
    ): Promise<OpnameRow> {
        assertSupportActor(actor);
        const parsedId = parseOpnameId(id);
        const reviewerEmail = actorEmail(actor, null);

        try {
            return await withTransaction(async (client) => {
                const existing = await opnameRepository.findByIdForUpdate(parsedId, client);
                if (!existing) throw new AppError("Data opname tidak ditemukan", 404);
                const updated = await opnameRepository.updateSupportReview({
                    id_opname_item: parsedId,
                    decision: input.decision,
                    alasan_penolakan_support: input.alasan_penolakan_support,
                    reviewer_email: reviewerEmail,
                }, client);
                await opnameRepository.insertRevisionHistory({
                    id_opname_item: updated.id,
                    revision_no: updated.revision_no,
                    previous_status: existing.status,
                    next_status: updated.status,
                    actor_email: reviewerEmail,
                    actor_role: normalizeActorRoles(actor).join(", "),
                    snapshot: updated,
                }, client);
                await opnameFinalRepository.updateTotals(String(updated.id_opname_final), client);
                return normalizeOpnameFotoLink(updated);
            });
        } catch (error) {
            if (error instanceof AppError) throw error;
            return mapPgError(error);
        }
    },

    async reviseContractorFirstOpnameItem(
        id: string,
        input: ContractorOpnameRevisionInput,
        actor?: AuthenticatedUser | null
    ): Promise<OpnameRow> {
        assertContractorActor(actor);
        const parsedId = parseOpnameId(id);
        const submitterEmail = actorEmail(actor, null);

        try {
            return await withTransaction(async (client) => {
                const existing = await opnameRepository.findByIdForUpdate(parsedId, client);
                if (!existing) throw new AppError("Data opname tidak ditemukan", 404);
                const updated = await opnameRepository.updateContractorRevision({
                    id_opname_item: parsedId,
                    actor_email: submitterEmail,
                    item: input,
                }, client);
                await opnameRepository.insertRevisionHistory({
                    id_opname_item: updated.id,
                    revision_no: updated.revision_no,
                    previous_status: existing.status,
                    next_status: updated.status,
                    actor_email: submitterEmail,
                    actor_role: normalizeActorRoles(actor).join(", "),
                    snapshot: updated,
                }, client);
                await opnameFinalRepository.updateTotals(String(updated.id_opname_final), client);
                return normalizeOpnameFotoLink(updated);
            });
        } catch (error) {
            if (error instanceof AppError) throw error;
            return mapPgError(error);
        }
    },

    async listContractorFirst(query: ListOpnameQueryInput): Promise<{ toko: TokoSummaryRow | null; items: OpnameRow[]; instruksi_lapangan_items: Awaited<ReturnType<typeof instruksiLapanganRepository.getApprovedItemsByTokoId>> }> {
        const result = await this.list(query);
        return {
            ...result,
            items: result.items.filter((item) => item.workflow_version === "contractor_first")
        };
    },
    async list(query: ListOpnameQueryInput): Promise<{ toko: TokoSummaryRow | null; items: OpnameRow[]; instruksi_lapangan_items: Awaited<ReturnType<typeof instruksiLapanganRepository.getApprovedItemsByTokoId>> }> {
        const items = await opnameRepository.findAll(query);
        const toko = typeof query.id_toko === "number"
            ? await opnameRepository.findTokoById(query.id_toko)
            : null;
        const instruksiLapanganItems = typeof query.id_toko === "number"
            ? await instruksiLapanganRepository.getApprovedItemsByTokoId(query.id_toko)
            : [];

        return {
            toko,
            instruksi_lapangan_items: instruksiLapanganItems,
            items: items.map((item) => normalizeOpnameFotoLink(item))
        };
    },

    async getById(id: string) {
        const parsedId = parseOpnameId(id);
        const data = await opnameRepository.findById(String(parsedId));
        if (!data) {
            throw new AppError("Data opname tidak ditemukan", 404);
        }

        return normalizeOpnameFotoLink(data);
    },

    async update(
        id: string,
        input: UpdateOpnameInput,
        uploadedFotoOpname?: UploadedFotoOpnameFile
    ): Promise<OpnameRow> {
        try {
            const parsedId = parseOpnameId(id);
            const existing = await opnameRepository.findById(String(parsedId));
            if (!existing) {
                throw new AppError("Data opname tidak ditemukan", 404);
            }

            const fotoLink = uploadedFotoOpname
                ? await uploadFotoOpnameToDrive(existing.id_toko, uploadedFotoOpname)
                : undefined;

            const payload = fotoLink
                ? { ...input, foto: fotoLink }
                : input;

            const data = await opnameRepository.updateById(String(parsedId), payload);
            if (!data) {
                throw new AppError("Data opname tidak ditemukan", 404);
            }

            await refreshOpnameFinalDenda(data.id_opname_final, data.id_toko);
            await opnameFinalRepository.updateTotals(String(data.id_opname_final));
            return normalizeOpnameFotoLink(data);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async getFotoDownloadPayload(id: string) {
        const parsedId = parseOpnameId(id);
        const data = await opnameRepository.findById(String(parsedId));
        if (!data) {
            throw new AppError("Data opname tidak ditemukan", 404);
        }

        const rawLink = data.foto?.trim();
        if (!rawLink) {
            throw new AppError("Foto opname tidak tersedia", 404);
        }

        const fileId = extractDriveFileId(rawLink);
        const gp = GoogleProvider.instance;

        let fileBuffer: Buffer | null = null;
        let contentType: string | null = null;
        let filename: string | null = null;

        if (fileId && gp.spartaDrive) {
            fileBuffer = await gp.getFileBufferById(gp.spartaDrive, fileId);

            try {
                const meta = await gp.spartaDrive.files.get({ fileId, fields: "name,mimeType" });
                filename = meta.data.name ?? null;
                contentType = meta.data.mimeType ?? null;
            } catch {
                // best effort metadata only
            }
        }

        if (!fileBuffer) {
            const fallbackUrl = normalizeDriveDownloadLink(rawLink) ?? rawLink;
            const response = await fetch(fallbackUrl);
            if (!response.ok) {
                throw new AppError("Gagal mengambil file foto opname", 502);
            }
            fileBuffer = Buffer.from(await response.arrayBuffer());
            contentType = response.headers.get("content-type") || contentType;
        }

        if (!fileBuffer.length) {
            throw new AppError("File foto opname kosong", 502);
        }

        const ext = inferFileExtension(contentType);
        const resolvedFilename = filename || `OPNAME_FOTO_${data.id_toko}_${data.id}${ext}`;

        return {
            filename: resolvedFilename,
            contentType: contentType || "application/octet-stream",
            fileBuffer,
        };
    },

    async remove(id: string) {
        const parsedId = parseOpnameId(id);
        const deleted = await opnameRepository.deleteById(String(parsedId));
        if (!deleted) {
            throw new AppError("Data opname tidak ditemukan", 404);
        }

        return { id: parsedId, deleted: true };
    }
};

