import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { calculateDendaByTokoId } from "../denda/denda-keterlambatan";
import { instruksiLapanganRepository } from "../instruksi-lapangan/instruksi-lapangan.repository";
import { rabRepository } from "../rab/rab.repository";
import { buildOpnameFinalPdfBuffer } from "./opname-final.pdf";
import { calculateOpnameFinalFinancials, isNoPpnArea } from "./opname-final.financial";
import { OPNAME_FINAL_STATUS, type OpnameFinalStatus } from "./opname-final.constants";
import { opnameFinalRepository } from "./opname-final.repository";
import type { OpnameFinalDetail, OpnameFinalIdRow } from "./opname-final.repository";
import type { LockOpnameFinalInput, OpnameFinalListQueryInput } from "./opname-final.schema";

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

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_final_toko") {
        throw new AppError("id_toko tidak ditemukan di tabel toko", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_rab_item") {
        throw new AppError("id_rab_item tidak ditemukan di tabel rab_item", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_instruksi_lapangan_item") {
        throw new AppError("id_instruksi_lapangan_item tidak ditemukan di tabel instruksi_lapangan_item", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_item_toko") {
        throw new AppError("id_toko tidak ditemukan di tabel toko", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_opname_item_status") {
        throw new AppError("status opname item tidak valid (gunakan: pending, disetujui, ditolak)", 400);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_opname_item_source") {
        throw new AppError("Sumber item opname tidak valid. Isi tepat salah satu: id_rab_item atau id_instruksi_lapangan_item", 400);
    }

    throw error;
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseAreaNumber = (value?: string | number | null): number => {
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    const normalized = raw
        .replace(/\s+/g, "")
        .replace(/,/g, ".")
        .replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStatusTransition = (
    currentStatus: OpnameFinalStatus,
    action: ApprovalActionInput
): OpnameFinalStatus => {
    if (action.tindakan === "APPROVE") {
        if (action.jabatan === "KOORDINATOR") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval koordinator`, 409);
            }
            return OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER;
        }

        if (action.jabatan === "MANAGER") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval manager`, 409);
            }
            return OPNAME_FINAL_STATUS.WAITING_FOR_DIREKTUR;
        }

        if (action.jabatan === "DIREKTUR") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_DIREKTUR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval direktur`, 409);
            }
            return OPNAME_FINAL_STATUS.APPROVED;
        }

        throw new AppError(`Jabatan "${action.jabatan}" tidak dikenali`, 400);
    }

    if (action.jabatan === "DIREKTUR") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_DIREKTUR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject direktur`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_DIREKTUR;
    }

    if (action.jabatan === "KOORDINATOR") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject koordinator`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_COORDINATOR;
    }

    if (action.jabatan === "MANAGER") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject manager`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_MANAGER;
    }

    throw new AppError(`Jabatan "${action.jabatan}" tidak dikenali`, 400);
};

const uploadPdfToDrive = async (buffer: Buffer, filename: string): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) {
        throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);
    }

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer,
        2,
        drive
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
};

const loadInstruksiLapanganItems = async (idToko: number) => {
    const approvedInstruksi = await instruksiLapanganRepository.getApprovedByTokoId(idToko);
    if (approvedInstruksi.length === 0) {
        return [];
    }

    const itemGroups = await Promise.all(
        approvedInstruksi.map((instruksi) => instruksiLapanganRepository.getItems(instruksi.id))
    );
    return itemGroups.flat();
};

const loadRabData = async (opnameFinalId: number) => {
    const items = await rabRepository.listItemsByOpnameFinalId(opnameFinalId);
    if (items.length === 0) {
        return { header: null, items: [] };
    }

    const rabId = items[0]?.id_rab;
    const header = rabId ? (await rabRepository.findById(String(rabId)))?.rab ?? null : null;
    return { header, items };
};

const calculateOpnameKtkTotal = (
    detail: OpnameFinalDetail,
    instruksiLapanganItems: Awaited<ReturnType<typeof loadInstruksiLapanganItems>>,
    rabData: Awaited<ReturnType<typeof loadRabData>>
): number => {
    const noPpn = isNoPpnArea(detail.toko);
    const opnameItems = detail.items ?? [];
    const rabItems = rabData.items ?? [];
    const kerjaTambahItems = opnameItems.filter((item) => toNumber(item.total_selisih) > 0);
    const kerjaKurangItems = opnameItems.filter((item) => toNumber(item.total_selisih) < 0);
    const totalRabItems = rabItems.reduce((acc, item) => acc + toNumber(item.total_harga), 0);
    const totalIl = instruksiLapanganItems.reduce((acc, item) => acc + toNumber(item.total_harga), 0);
    const totalKerjaTambah = kerjaTambahItems.reduce((acc, item) => acc + toNumber(item.total_selisih), 0);
    const totalKerjaKurang = kerjaKurangItems.reduce((acc, item) => acc + toNumber(item.total_selisih), 0);
    const nilaiDenda = toNumber(detail.opname_final.nilai_denda);

    return calculateOpnameFinalFinancials({
        rab: totalRabItems,
        instruksiLapangan: totalIl,
        kerjaTambah: totalKerjaTambah,
        kerjaKurang: totalKerjaKurang,
        denda: nilaiDenda,
        noPpn,
    }).totalFinal;
};

const applyRukoConversionIfNeeded = async (
    detail: OpnameFinalDetail,
    instruksiLapanganItems: Awaited<ReturnType<typeof loadInstruksiLapanganItems>>,
    rabData: Awaited<ReturnType<typeof loadRabData>>
) => {
    if (detail.opname_final.status_opname_final !== OPNAME_FINAL_STATUS.APPROVED) return null;

    const context = await opnameFinalRepository.getRukoConversionContext(detail.toko.id);
    if (!context?.is_ruko) return null;

    const luasAreaTerbangun = parseAreaNumber(context.luas_area_terbangun);
    if (luasAreaTerbangun <= 0) return null;

    const totalOpnameKtk = calculateOpnameKtkTotal(detail, instruksiLapanganItems, rabData);
    const costPerM2 = totalOpnameKtk / luasAreaTerbangun;
    if (costPerM2 <= 900000) return null;

    const result = await opnameFinalRepository.applyNonRukoConversion(detail.toko.id);
    console.info("[opname-final] Ruko dikonversi otomatis ke Non-Ruko", {
        id_toko: detail.toko.id,
        nomor_ulok: detail.toko.nomor_ulok,
        total_opname_ktk: totalOpnameKtk,
        luas_area_terbangun: luasAreaTerbangun,
        cost_per_m2: costPerM2,
        ...result,
    });

    return {
        total_opname_ktk: totalOpnameKtk,
        luas_area_terbangun: luasAreaTerbangun,
        cost_per_m2: costPerM2,
        ...result,
    };
};

type DendaPayload = {
    hari_denda: number;
    nilai_denda: number;
    tanggal_akhir_spk: string | null;
    tanggal_serah_terima: string | null;
};

const zeroAllocatedDenda = (): DendaPayload => ({
    hari_denda: 0,
    nilai_denda: 0,
    tanggal_akhir_spk: null,
    tanggal_serah_terima: null,
});

const isSipilScope = (row: OpnameFinalIdRow): boolean =>
    String(row.lingkup_pekerjaan ?? "").trim().toUpperCase() === "SIPIL";

const resolvePenaltyOwner = (rows: OpnameFinalIdRow[]): OpnameFinalIdRow | null => {
    if (rows.length === 0) return null;
    return rows.find(isSipilScope) ?? rows[0];
};

const refreshDenda = async (opnameFinalId: string, idToko: number) => {
    const denda = await calculateDendaByTokoId(idToko);
    const scopedRows = await opnameFinalRepository.listIdsByPenaltyScope(idToko);
    const owner = resolvePenaltyOwner(scopedRows);
    const isCurrentOwner = !owner || String(owner.id) === String(opnameFinalId);
    const allocatedDenda = isCurrentOwner ? denda : zeroAllocatedDenda();

    // Safety guard: jangan overwrite denda valid jika perhitungan baru gagal (return 0)
    if (isCurrentOwner && denda.hari_denda === 0 && denda.tanggal_akhir_spk === null) {
        const existing = await opnameFinalRepository.findById(opnameFinalId);
        const existingHari = Number(existing?.opname_final.hari_denda ?? 0);
        if (existingHari > 0) {
            console.warn(`[DENDA] Skip update opname_final ${opnameFinalId}: calculated=0 but existing=${existingHari}. Keeping existing data.`);
            return {
                hari_denda: existingHari,
                nilai_denda: Number(existing!.opname_final.nilai_denda ?? 0),
                tanggal_akhir_spk: existing!.opname_final.tanggal_akhir_spk_denda ?? null,
                tanggal_serah_terima: existing!.opname_final.tanggal_serah_terima_denda ?? null,
            };
        }
    }

    await opnameFinalRepository.updateDenda(opnameFinalId, allocatedDenda);
    return allocatedDenda;
};


const refreshDendaByTokoScope = async (idToko: number) => {
    const rows = await opnameFinalRepository.listIdsByPenaltyScope(idToko);
    if (rows.length === 0) {
        return 0;
    }

    const denda = await calculateDendaByTokoId(idToko);
    const owner = resolvePenaltyOwner(rows);

    await Promise.all(rows.map(async (row) => {
        const allocatedDenda = owner && row.id === owner.id ? denda : zeroAllocatedDenda();
        await opnameFinalRepository.updateDenda(String(row.id), allocatedDenda);
        await opnameFinalRepository.updateTotals(String(row.id));
    }));
    return rows.length;
};

const refreshDendaAllocation = async (opnameFinalId: string, idToko: number) => {
    const updatedCount = await refreshDendaByTokoScope(idToko);
    if (updatedCount === 0) {
        await refreshDenda(opnameFinalId, idToko);
    }
    return updatedCount;
};

const regeneratePdfAndUpload = async (opnameFinalId: string): Promise<string> => {
    const detail = await opnameFinalRepository.findById(opnameFinalId);
    if (!detail) {
        throw new AppError("Data opname_final tidak ditemukan", 404);
    }

    const instruksiLapanganItems = await loadInstruksiLapanganItems(detail.toko.id);
    const rabData = await loadRabData(detail.opname_final.id);
    await applyRukoConversionIfNeeded(detail, instruksiLapanganItems, rabData);
    const pdfBuffer = await buildOpnameFinalPdfBuffer(detail, instruksiLapanganItems, rabData);
    const proyek = sanitizeFilenamePart(detail.toko.proyek ?? undefined, "PROYEK");
    const nomorUlok = sanitizeFilenamePart(detail.toko.nomor_ulok ?? undefined, "ULOK");
    const filenamePrefix = "OPNAME";
    const filename = `${filenamePrefix}_${proyek}_${nomorUlok}_${detail.opname_final.id}.pdf`;

    return uploadPdfToDrive(pdfBuffer, filename);
};

export const opnameFinalService = {
    async list(query: OpnameFinalListQueryInput) {
        return opnameFinalRepository.list(query);
    },

    async getById(id: string) {
        await opnameFinalRepository.updateTotals(id);
        const data = await opnameFinalRepository.findById(id);
        if (!data) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        return data;
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const detail = await opnameFinalRepository.findById(id);
        if (!detail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        if ((detail.opname_final.aksi || "").toLowerCase() !== "terkunci") {
            throw new AppError("Opname final belum dikunci. Approval hanya bisa dilakukan saat aksi = terkunci", 409);
        }

        const currentStatus = detail.opname_final.status_opname_final;
        const newStatus = resolveStatusTransition(currentStatus, action);

        await opnameFinalRepository.updateApproval(id, newStatus, action);
        await refreshDendaAllocation(id, detail.toko.id);
        await opnameFinalRepository.updateTotals(id);

        const linkPdf = await regeneratePdfAndUpload(id);
        await opnameFinalRepository.updatePdfLink(id, linkPdf);

        return {
            id: Number(id),
            old_status: currentStatus,
            new_status: newStatus,
            link_pdf_opname: linkPdf
        };
    },

    async generatePdf(id: string) {
        const detail = await opnameFinalRepository.findById(id);
        if (!detail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        await refreshDendaAllocation(id, detail.toko.id);
        await opnameFinalRepository.updateTotals(id);
        const refreshedDetail = await opnameFinalRepository.findById(id);
        if (!refreshedDetail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        const instruksiLapanganItems = await loadInstruksiLapanganItems(refreshedDetail.toko.id);
        const rabData = await loadRabData(refreshedDetail.opname_final.id);
        await applyRukoConversionIfNeeded(refreshedDetail, instruksiLapanganItems, rabData);
        const pdfBuffer = await buildOpnameFinalPdfBuffer(refreshedDetail, instruksiLapanganItems, rabData);
        const proyek = sanitizeFilenamePart(refreshedDetail.toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(refreshedDetail.toko.nomor_ulok ?? undefined, "ULOK");
        const filenamePrefix = "OPNAME";

        return {
            filename: `${filenamePrefix}_${proyek}_${nomorUlok}_${id}.pdf`,
            pdfBuffer
        };
    },

    async lockOpnameFinal(id: string, payload: LockOpnameFinalInput) {
        try {
            const result = await opnameFinalRepository.lockById(id, payload);
            if (result.item_count === 0) {
                throw new AppError("Data opname_final tidak ditemukan", 404);
            }

            await refreshDendaAllocation(id, payload.id_toko);
            await opnameFinalRepository.updateTotals(id);
            const linkPdf = await regeneratePdfAndUpload(id);
            await opnameFinalRepository.updatePdfLink(id, linkPdf);

            return {
                id: Number(id),
                id_toko: payload.id_toko,
                aksi: payload.aksi ?? "terkunci",
                status_opname_final: OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR,
                item_count: result.item_count,
                link_pdf_opname: linkPdf
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async refreshDendaAndPdfById(id: string) {
        const detail = await opnameFinalRepository.findById(id);
        if (!detail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        await refreshDendaAllocation(id, detail.toko.id);
        await opnameFinalRepository.updateTotals(id);
        const linkPdf = await regeneratePdfAndUpload(id);
        await opnameFinalRepository.updatePdfLink(id, linkPdf);

        return {
            id: Number(id),
            link_pdf_opname: linkPdf
        };
    },

    async refreshDendaByTokoId(idToko: number) {
        const updatedCount = await refreshDendaByTokoScope(idToko);

        return {
            id_toko: idToko,
            updated_count: updatedCount
        };
    }
};
