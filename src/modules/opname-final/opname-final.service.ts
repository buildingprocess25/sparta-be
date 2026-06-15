import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { calculateDendaByTokoId } from "../denda/denda-keterlambatan";
import { instruksiLapanganRepository } from "../instruksi-lapangan/instruksi-lapangan.repository";
import { rabRepository } from "../rab/rab.repository";
import { buildOpnameFinalPdfBuffer } from "./opname-final.pdf";
import { OPNAME_FINAL_STATUS, type OpnameFinalStatus } from "./opname-final.constants";
import { opnameFinalRepository } from "./opname-final.repository";
import type { OpnameFinalDetail } from "./opname-final.repository";
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

const roundDownTenThousand = (value: number): number => {
    const numeric = Number(value) || 0;
    const sign = numeric < 0 ? -1 : 1;
    return sign * Math.floor(Math.abs(numeric) / 10000) * 10000;
};

const roundUpTenThousand = (value: number): number => {
    const numeric = Number(value) || 0;
    if (numeric === 0) return 0;
    const sign = numeric < 0 ? -1 : 1;
    return sign * Math.ceil(Math.abs(numeric) / 10000) * 10000;
};

const buildFinancialGrandTotal = (total: number, direction: "down" | "up", noPpn = false): number => {
    const pembulatan = direction === "down" ? roundDownTenThousand(total) : roundUpTenThousand(total);
    return pembulatan + (noPpn ? 0 : Math.round(pembulatan * 0.11));
};

const normalizeNoPpnText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();

const isNoPpnArea = (toko: { cabang?: string | null; nama_toko?: string | null; alamat?: string | null }): boolean => {
    const identity = [toko.cabang, toko.nama_toko, toko.alamat].map(normalizeNoPpnText);
    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
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

const loadRabData = async (idToko: number) => {
    const latestRab = await rabRepository.findLatestByTokoId(idToko);
    if (!latestRab) {
        return { header: null, items: [] };
    }

    const items = await rabRepository.listItemsByRabId(latestRab.id);
    return { header: latestRab, items };
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

    return buildFinancialGrandTotal(totalRabItems, "down", noPpn)
        + buildFinancialGrandTotal(totalIl, "up", noPpn)
        + buildFinancialGrandTotal(totalKerjaTambah, "up", noPpn)
        - Math.abs(buildFinancialGrandTotal(totalKerjaKurang, "up", noPpn))
        - nilaiDenda;
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

const refreshDenda = async (opnameFinalId: string, idToko: number) => {
    const denda = await calculateDendaByTokoId(idToko);

    // Safety guard: jangan overwrite denda valid jika perhitungan baru gagal (return 0)
    if (denda.hari_denda === 0 && denda.tanggal_akhir_spk === null) {
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

    await opnameFinalRepository.updateDenda(opnameFinalId, denda);
    return denda;
};


const refreshDendaByTokoScope = async (idToko: number) => {
    const rows = await opnameFinalRepository.listIdsByPenaltyScope(idToko);
    await Promise.all(rows.map((row) => refreshDenda(String(row.id), row.id_toko)));
    return rows.length;
};

const regeneratePdfAndUpload = async (opnameFinalId: string): Promise<string> => {
    const detail = await opnameFinalRepository.findById(opnameFinalId);
    if (!detail) {
        throw new AppError("Data opname_final tidak ditemukan", 404);
    }

    const instruksiLapanganItems = await loadInstruksiLapanganItems(detail.toko.id);
    const rabData = await loadRabData(detail.toko.id);
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
        await opnameFinalRepository.updateTotals(id);
        await refreshDenda(id, detail.toko.id);

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

        await refreshDenda(id, detail.toko.id);
        const refreshedDetail = await opnameFinalRepository.findById(id);
        if (!refreshedDetail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        const instruksiLapanganItems = await loadInstruksiLapanganItems(refreshedDetail.toko.id);
        const rabData = await loadRabData(refreshedDetail.toko.id);
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

            await refreshDenda(id, payload.id_toko);
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

        await refreshDenda(id, detail.toko.id);
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
