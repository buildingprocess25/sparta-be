import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { AuthenticatedUser } from "../auth/auth-session.service";
import { calculateDendaByTokoId } from "../denda/denda-keterlambatan";
import { opnameFinalService } from "../opname-final/opname-final.service";
import { canManageSystemMaintenance } from "../system-maintenance/system-maintenance.service";
import {
    buildSerahTerimaPdfBuffer,
    buildSerahTerimaUnifiedAssessmentPdfBuffer,
    buildSerahTerimaUnifiedCoverPdfBuffer,
    calculateSerahTerimaAssessmentScore
} from "./serah-terima.pdf";
import { serahTerimaRepository } from "./serah-terima.repository";
import { PDFDocument } from "pdf-lib";

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
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

const normalizeDriveDownloadLink = (value: string): string => {
    const fileId = extractDriveFileId(value);
    if (!fileId) return value;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const downloadStoredPdfBuffer = async (linkPdf?: string | null): Promise<Buffer | null> => {
    if (!linkPdf) return null;

    const gp = GoogleProvider.instance;
    const fileId = extractDriveFileId(linkPdf);
    let buffer: Buffer | null = null;

    if (fileId) {
        if (gp.spartaDrive) {
            buffer = await gp.getFileBufferById(gp.spartaDrive, fileId);
        }
        if (!buffer && gp.docDrive) {
            buffer = await gp.getFileBufferById(gp.docDrive, fileId);
        }
    }

    if (!buffer && /^https?:\/\//i.test(linkPdf)) {
        const response = await fetch(normalizeDriveDownloadLink(linkPdf));
        if (response.ok) {
            buffer = Buffer.from(await response.arrayBuffer());
        }
    }

    return buffer && buffer.length > 0 ? buffer : null;
};

const dateOnlyKey = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
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

const buildDetailByTokoId = async (idToko: number) => {
    const toko = await serahTerimaRepository.findTokoById(idToko);
    if (!toko) {
        throw new AppError("Data toko tidak ditemukan", 404);
    }

    const opnameFinal = await serahTerimaRepository.findOpnameFinalByIdToko(idToko);
    if (!opnameFinal) {
        throw new AppError("Data opname_final tidak ditemukan untuk toko ini", 404);
    }

    const items = await serahTerimaRepository.findOpnameItemsByOpnameFinalId(opnameFinal.id);
    return { toko, opnameFinal, items };
};

const mergePdfBuffers = async (buffers: Buffer[]): Promise<Buffer> => {
    const merged = await PDFDocument.create();

    for (const buffer of buffers) {
        const source = await PDFDocument.load(buffer);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
    }

    return Buffer.from(await merged.save());
};

const getSerahTerimaReadiness = async (idToko: number) => {
    const opnameFinal = await serahTerimaRepository.findOpnameFinalByIdToko(idToko);
    if (!opnameFinal) {
        return {
            ready: false,
            reason: "Data opname_final belum tersedia untuk toko ini",
        };
    }

    const completion = await serahTerimaRepository.getSupervisionCompletionByTokoId(idToko);
    if (!completion.gantt_id || Number(completion.total_checkpoints) === 0) {
        const opnameItemCount = await serahTerimaRepository.countOpnameItemsByOpnameFinalId(opnameFinal.id);

        return {
            ready: false,
            reason: completion.gantt_id && opnameItemCount > 0
                ? "Belum ada latest pengawasan selesai untuk toko ini"
                : "Belum ada pekerjaan pengawasan selesai untuk toko ini",
        };
    }

    if (Number(completion.incomplete_checkpoints) > 0) {
        return {
            ready: false,
            reason: `Masih ada ${completion.incomplete_checkpoints} pekerjaan pengawasan yang belum selesai`,
        };
    }

    if (Number(completion.missing_checkpoints) > 0) {
        return {
            ready: false,
            reason: `Masih ada ${completion.missing_checkpoints} pekerjaan selesai yang belum masuk Opname`,
        };
    }

    return {
        ready: true,
        reason: null,
    };
};

const assertSerahTerimaReady = async (idToko: number) => {
    const readiness = await getSerahTerimaReadiness(idToko);
    if (!readiness.ready) {
        throw new AppError(readiness.reason ?? "Serah Terima belum siap dibuat", 409);
    }
};

const assertSerahTerimaReadyForUnified = async (idToko: number) => {
    const readiness = await getSerahTerimaReadiness(idToko);
    if (readiness.ready) return;

    const [existingBerkas, opnameFinal] = await Promise.all([
        serahTerimaRepository.findBerkasSerahTerimaByIdToko(idToko),
        serahTerimaRepository.findOpnameFinalByIdToko(idToko),
    ]);
    const opnameItemCount = opnameFinal
        ? await serahTerimaRepository.countOpnameItemsByOpnameFinalId(opnameFinal.id)
        : 0;

    if (existingBerkas?.link_pdf && opnameItemCount > 0) {
        return;
    }

    throw new AppError(readiness.reason ?? "Serah Terima belum siap dibuat", 409);
};

const automaticSerahTerimaInProgress = new Set<number>();
const automaticUnifiedSerahTerimaInProgress = new Set<string>();

const scheduleAutomaticUnifiedSerahTerimaIfReady = async (nomorUlok?: string | null): Promise<void> => {
    const key = String(nomorUlok || "").trim();
    if (!key || automaticUnifiedSerahTerimaInProgress.has(key)) return;

    const scopes = await serahTerimaRepository.findTokoScopesByNomorUlok(key);
    const activeScopes = scopes.filter((scope) =>
        ["SIPIL", "ME"].includes(String(scope.lingkup_pekerjaan || "").trim().toUpperCase())
    );
    if (activeScopes.length < 2) return;

    const readiness = await Promise.all(activeScopes.map((scope) => getSerahTerimaReadiness(scope.id)));
    if (readiness.some((item) => !item.ready)) return;

    automaticUnifiedSerahTerimaInProgress.add(key);
    setImmediate(() => {
        serahTerimaService
            .createPdfSerahTerimaUnified(key)
            .then((result) => {
                console.log(`[ST][AUTO_UNIFIED] Berhasil generate unified ULOK=${key}, berkas=${result.id}`);
            })
            .catch((error) => {
                console.error("[ST][AUTO_UNIFIED] Gagal generate unified", {
                    nomorUlok: key,
                    error: error instanceof Error ? error.message : String(error)
                });
            })
            .finally(() => {
                automaticUnifiedSerahTerimaInProgress.delete(key);
            });
    });
};

export const scheduleAutomaticSerahTerimaIfReady = async (idToko: number, referenceTimestamp?: string): Promise<void> => {
    if (automaticSerahTerimaInProgress.has(idToko)) return;

    const existing = await serahTerimaRepository.findBerkasSerahTerimaByIdToko(idToko);
    if (existing?.link_pdf) return;

    const readiness = await getSerahTerimaReadiness(idToko);
    if (!readiness.ready) return;

    automaticSerahTerimaInProgress.add(idToko);
    setImmediate(() => {
        serahTerimaService
            .createPdfSerahTerima(idToko, referenceTimestamp)
            .then((result) => {
                console.log(`[ST][AUTO] Berhasil generate otomatis id_toko=${idToko}, berkas=${result.id}`);
            })
            .catch((error) => {
                console.error("[ST][AUTO] Gagal generate otomatis", {
                    idToko,
                    error: error instanceof Error ? error.message : String(error)
                });
            })
            .finally(() => {
                automaticSerahTerimaInProgress.delete(idToko);
            });
    });
};

export const serahTerimaService = {
    ensureDateCorrectionAuditSchema: () => serahTerimaRepository.ensureDateCorrectionAuditSchema(),

    async list(filter: { id_toko?: number; nomor_ulok?: string; cabang_array?: string[]; nama_kontraktor?: string } = {}) {
        const rows = await serahTerimaRepository.listBerkasSerahTerima({
            id_toko: filter.id_toko,
            nomor_ulok: filter.nomor_ulok,
            cabang_array: filter.cabang_array,
            nama_kontraktor: filter.nama_kontraktor,
        });

        // Compute denda on-the-fly when no official denda exists or when the ST date
        // was corrected but the denormalized opname_final denda fields are stale.
        // This ensures the serah terima list stays in sync with the dashboard's denda display.
        const enriched = await Promise.all(
            rows.map(async (row) => {
                let hariDenda = row.hari_denda;
                let nilaiDenda = row.nilai_denda;
                let tanggalAkhirSpkDenda = row.tanggal_akhir_spk_denda;
                let tanggalSerahTerimaDenda = row.tanggal_serah_terima_denda;

                const storedStDate = dateOnlyKey(tanggalSerahTerimaDenda);
                const actualStDate = dateOnlyKey(row.created_at);
                const shouldRecalculateDenda =
                    (hariDenda === null && tanggalAkhirSpkDenda === null)
                    || Boolean(storedStDate && actualStDate && storedStDate !== actualStDate);

                if (shouldRecalculateDenda) {
                    try {
                        const denda = await calculateDendaByTokoId(row.id_toko);
                        hariDenda = denda.hari_denda;
                        nilaiDenda = String(denda.nilai_denda);
                        tanggalAkhirSpkDenda = denda.tanggal_akhir_spk;
                        tanggalSerahTerimaDenda = denda.tanggal_serah_terima;
                    } catch {
                        // Silently keep null values if calculation fails
                    }
                }

                return {
                    id: row.id,
                    id_toko: row.id_toko,
                    link_pdf: row.link_pdf,
                    created_at: row.created_at,
                    toko: {
                        id: row.id_toko,
                        nomor_ulok: row.nomor_ulok,
                        lingkup_pekerjaan: row.lingkup_pekerjaan,
                        nama_toko: row.nama_toko,
                        kode_toko: row.kode_toko,
                        proyek: row.proyek,
                        cabang: row.cabang,
                        alamat: row.alamat,
                        nama_kontraktor: row.nama_kontraktor,
                    },
                    nilai_penawaran: row.nilai_penawaran,
                    nilai_spk: row.nilai_spk,
                    nilai_opname: row.nilai_opname,
                    hari_denda: hariDenda,
                    nilai_denda: nilaiDenda,
                    tanggal_akhir_spk_denda: tanggalAkhirSpkDenda,
                    tanggal_serah_terima_denda: tanggalSerahTerimaDenda,
                    nomor_spk: row.nomor_spk,
                };
            })
        );

        return enriched;
    },

    async correctDate(input: {
        nomor_ulok: string;
        cabang?: string | null;
        tanggal_serah_terima: string;
        catatan?: string | null;
        actor?: AuthenticatedUser | null;
    }) {
        // Koreksi tanggal diizinkan untuk Super Human dan Store & Branch Controlling Specialist
        const actorRoles = input.actor?.roles ?? [];
        const canCorrect = actorRoles.some((role) => {
            const r = String(role).trim().toUpperCase();
            return r.includes("SUPER HUMAN")
                || r.includes("STORE & BRANCH CONTROLLING");
        });
        if (!canCorrect) {
            throw new AppError("Anda tidak memiliki akses untuk mengubah tanggal serah terima.", 403);
        }

        await serahTerimaRepository.ensureDateCorrectionAuditSchema();

        const targets = await serahTerimaRepository.findDateCorrectionTargets({
            nomor_ulok: input.nomor_ulok,
            cabang: input.cabang ?? null,
        });

        if (targets.length === 0) {
            throw new AppError("Berkas Serah Terima pada scope tersebut tidak ditemukan.", 404);
        }

        const updatedRows = await serahTerimaRepository.updateBerkasSerahTerimaDate({
            ids: targets.map((target) => target.id),
            tanggal: input.tanggal_serah_terima,
        });

        await serahTerimaRepository.insertDateCorrectionAudit({
            targets,
            updatedRows,
            actorEmail: input.actor?.email_sat ?? null,
            actorRole: input.actor?.jabatan ?? input.actor?.roles.join(", ") ?? null,
            catatan: input.catatan ?? null,
        });

        const uniqueTokoIds = Array.from(new Set(updatedRows.map((row) => row.id_toko)));
        let refreshedDendaCount = 0;
        for (const idToko of uniqueTokoIds) {
            const refreshResult = await opnameFinalService.refreshDendaByTokoId(idToko);
            refreshedDendaCount += Number(refreshResult.updated_count ?? 0);
        }

        const refreshCorrectedDendaScope = () =>
            Promise.allSettled(uniqueTokoIds.map((idToko) => opnameFinalService.refreshDendaByTokoId(idToko)));

        setImmediate(() => {
            setTimeout(() => {
                refreshCorrectedDendaScope().catch((error) => {
                    console.error("[ST][DATE_CORRECTION] Refresh denda tertunda gagal", {
                        nomorUlok: input.nomor_ulok,
                        cabang: input.cabang ?? null,
                        error: error instanceof Error ? error.message : String(error),
                    });
                });
            }, 10_000);

            Promise.allSettled(updatedRows.map((row) => serahTerimaService.regeneratePdfByBerkasId(row.id)))
                .then((results) => {
                    const failed = results.filter((result) => result.status === "rejected");
                    if (failed.length > 0) {
                        console.error(`[ST][DATE_CORRECTION] ${failed.length} PDF gagal diregenerasi`, {
                            nomorUlok: input.nomor_ulok,
                            cabang: input.cabang ?? null,
                        });
                    }
                    return refreshCorrectedDendaScope();
                })
                .catch((error) => {
                    console.error("[ST][DATE_CORRECTION] Regenerate PDF background gagal", {
                        nomorUlok: input.nomor_ulok,
                        cabang: input.cabang ?? null,
                        error: error instanceof Error ? error.message : String(error),
                    });
                });
        });

        const refreshed = await serahTerimaService.list({ nomor_ulok: input.nomor_ulok });

        return {
            nomor_ulok: input.nomor_ulok,
            cabang: input.cabang ?? null,
            tanggal_serah_terima: input.tanggal_serah_terima,
            affected_count: updatedRows.length,
            refreshed_denda_count: refreshedDendaCount,
            pdf_refresh_queued_count: updatedRows.length,
            items: refreshed.filter((item) => {
                if (!input.cabang) return true;
                return String(item.toko.cabang ?? "").trim().toUpperCase() === String(input.cabang).trim().toUpperCase();
            }),
        };
    },

    async listDateCorrectionHistory(input: {
        nomor_ulok: string;
        cabang?: string | null;
        actor?: AuthenticatedUser | null;
    }) {
        if (!canManageSystemMaintenance(input.actor)) {
            throw new AppError("Anda tidak memiliki akses untuk melihat riwayat koreksi tanggal serah terima.", 403);
        }

        return serahTerimaRepository.listDateCorrectionAudit({
            nomor_ulok: input.nomor_ulok,
            cabang: input.cabang ?? null,
        });
    },


    async createPdfSerahTerima(idToko: number, referenceTimestamp?: string) {
        // Validate the required opname data before writing a serah-terima placeholder.
        // Previously, a failed generation could leave a row with link_pdf = NULL.
        await assertSerahTerimaReady(idToko);
        await buildDetailByTokoId(idToko);

        const placeholder = referenceTimestamp
            ? await serahTerimaRepository.ensureBerkasSerahTerimaWithTimestamp(idToko, referenceTimestamp)
            : await serahTerimaRepository.ensureBerkasSerahTerima(idToko);

        // 1. Refresh denda dengan timestamp resmi ST yang ditentukan server.
        await opnameFinalService.refreshDendaByTokoId(idToko);

        const { toko, opnameFinal, items } = await buildDetailByTokoId(idToko);
        const detail = { toko, opname_final: opnameFinal, items };
        const pdfBuffer = await buildSerahTerimaPdfBuffer(detail, placeholder.created_at);

        // 2. Upload ke Google Drive
        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");
        const filename = `SERAH_TERIMA_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`;

        const linkPdf = await uploadPdfToDrive(pdfBuffer, filename);

        // 3. Simpan link di tabel berkas_serah_terima
        const berkas = await serahTerimaRepository.updateBerkasSerahTerimaLink(placeholder.id, linkPdf);

        // 4. Regenerate Opname Final PDF di background.
        //    Proses ini berat karena memuat ulang seluruh foto dan merender PDF kedua.
        //    Berkas Serah Terima sudah aman tersimpan, jadi response client tidak perlu
        //    menunggu proses tambahan ini dan berisiko diputus oleh timeout proxy Render.
        setImmediate(() => {
            opnameFinalService
                .refreshDendaAndPdfById(String(opnameFinal.id))
                .then(() => {
                    console.log(`[ST][OPNAME_PDF_BACKGROUND] Berhasil regenerate opname final id=${opnameFinal.id}`);
                })
                .catch((err) => {
                    console.error("[ST][OPNAME_PDF_BACKGROUND] Gagal regenerate opname final", {
                        opnameFinalId: opnameFinal.id,
                        idToko,
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
        });

        // 5. Auto-cascade: generate ST untuk toko saudara (nomor_ulok sama, lingkup berbeda)
        //    yang seluruh pengawasannya terisi, sudah punya Opname Final, dan belum punya berkas.
        //    Jalankan di background — tidak memblok response ke client.
        if (toko.nomor_ulok) {
            serahTerimaRepository
                .findSiblingTokosReadyForST(toko.nomor_ulok, idToko)
                .then(async (siblings) => {
                    for (const sibling of siblings) {
                        try {
                            await serahTerimaService.createPdfSerahTerima(sibling.id);
                            console.log(
                                `[ST Cascade] Berhasil generate ST untuk toko id=${sibling.id}` +
                                ` (${sibling.lingkup_pekerjaan ?? "?"}) dari ULOK ${toko.nomor_ulok}`
                            );
                        } catch (err: any) {
                            // Jangan sampai error sibling menggagalkan response utama
                            console.error(
                                `[ST Cascade] Gagal generate ST untuk toko id=${sibling.id}` +
                                ` (${sibling.lingkup_pekerjaan ?? "?"}): ${err?.message ?? err}`
                            );
                        }
                    }
                    await scheduleAutomaticUnifiedSerahTerimaIfReady(toko.nomor_ulok);
                })
                .catch((err) => {
                    console.error(`[ST Cascade] Gagal query sibling tokos: ${err?.message ?? err}`);
                });
            scheduleAutomaticUnifiedSerahTerimaIfReady(toko.nomor_ulok).catch((err) => {
                console.error(`[ST][AUTO_UNIFIED] Gagal schedule ULOK ${toko.nomor_ulok}: ${err?.message ?? err}`);
            });
        }

        return {
            id: berkas.id,
            id_toko: idToko,
            link_pdf: linkPdf,
            opname_final_id: opnameFinal.id,
            link_pdf_opname: opnameFinal.link_pdf_opname,
            item_count: items.length,
            created_at: berkas.created_at,
            toko,
        };
    },

    async createPdfSerahTerimaUnified(nomorUlok: string) {
        const scopes = await serahTerimaRepository.findTokoScopesByNomorUlok(nomorUlok);
        if (scopes.length === 0) {
            throw new AppError("ULOK tidak ditemukan", 404);
        }

        const activeScopes = scopes.filter((scope) =>
            ["SIPIL", "ME"].includes(String(scope.lingkup_pekerjaan || "").trim().toUpperCase())
        );
        const targetScopes = activeScopes.length > 0 ? activeScopes : scopes;
        const masterScope = targetScopes.find((scope) =>
            String(scope.lingkup_pekerjaan || "").trim().toUpperCase() === "SIPIL"
        ) ?? targetScopes[0];

        for (const scope of targetScopes) {
            await assertSerahTerimaReadyForUnified(scope.id);
        }

        const placeholder = await serahTerimaRepository.ensureBerkasSerahTerima(masterScope.id);
        const pdfBuffers: Buffer[] = [];
        const details: Array<{
            id_toko: number;
            lingkup_pekerjaan: string | null;
            opname_final_id: number;
            item_count: number;
            kode_toko?: string | null;
            nama_kontraktor?: string | null;
            nilai_opname?: string | number | null;
            nilai_toko: number;
        }> = [];

        for (const [index, scope] of targetScopes.entries()) {
            await opnameFinalService.refreshDendaByTokoId(scope.id);
            const { toko, opnameFinal, items } = await buildDetailByTokoId(scope.id);
            const buffer = await buildSerahTerimaPdfBuffer(
                { toko, opname_final: opnameFinal, items },
                placeholder.created_at,
                { unifiedPartIndex: index + 1, unifiedPartTotal: targetScopes.length }
            );

            pdfBuffers.push(buffer);
            details.push({
                id_toko: scope.id,
                lingkup_pekerjaan: scope.lingkup_pekerjaan,
                opname_final_id: opnameFinal.id,
                item_count: items.length,
                kode_toko: toko.kode_toko,
                nama_kontraktor: toko.nama_kontraktor,
                nilai_opname: opnameFinal.grand_total_opname,
                nilai_toko: calculateSerahTerimaAssessmentScore(items).nilaiToko,
            });
        }

        if (pdfBuffers.length === 0) {
            throw new AppError("Tidak ada scope yang siap dibuat Serah Terima", 409);
        }

        const coverBuffer = await buildSerahTerimaUnifiedCoverPdfBuffer({
            nomor_ulok: nomorUlok,
            nama_toko: masterScope.nama_toko,
            cabang: masterScope.cabang,
            proyek: masterScope.proyek,
            created_at: placeholder.created_at,
            scopes: details,
        });
        const assessmentBuffer = await buildSerahTerimaUnifiedAssessmentPdfBuffer({
            nomor_ulok: nomorUlok,
            nama_toko: masterScope.nama_toko,
            created_at: placeholder.created_at,
            scopes: details.map((detail) => ({
                lingkup_pekerjaan: detail.lingkup_pekerjaan,
                nilai_toko: detail.nilai_toko,
            })),
        });

        const mergedBuffer = await mergePdfBuffers([coverBuffer, ...pdfBuffers, assessmentBuffer]);

        const proyek = sanitizeFilenamePart(masterScope.proyek ?? undefined, "PROYEK");
        const safeNomorUlok = sanitizeFilenamePart(nomorUlok, "ULOK");
        const filename = `SERAH_TERIMA_UNIFIED_${proyek}_${safeNomorUlok}.pdf`;
        const linkPdf = await uploadPdfToDrive(mergedBuffer, filename);
        const berkasRows = await Promise.all(
            targetScopes.map(async (scope) => {
                const row = scope.id === masterScope.id
                    ? placeholder
                    : await serahTerimaRepository.ensureBerkasSerahTerima(scope.id);

                return serahTerimaRepository.updateBerkasSerahTerimaLinkAndDate({
                    id: row.id,
                    linkPdf,
                    createdAt: placeholder.created_at,
                });
            })
        );
        const berkas = berkasRows.find((row) => row.id_toko === masterScope.id) ?? berkasRows[0];

        setImmediate(() => {
            Promise.allSettled(
                details.map((detail) => opnameFinalService.refreshDendaAndPdfById(String(detail.opname_final_id)))
            ).then((results) => {
                const rejected = results.filter((result) => result.status === "rejected").length;
                if (rejected > 0) {
                    console.error(`[ST][UNIFIED][OPNAME_PDF_BACKGROUND] ${rejected} regenerate opname final gagal`, {
                        nomorUlok,
                    });
                }
            });
        });

        return {
            id: berkas.id,
            id_toko: masterScope.id,
            nomor_ulok: nomorUlok,
            link_pdf: linkPdf,
            scopes: details,
            item_count: details.reduce((sum, detail) => sum + detail.item_count, 0),
            created_at: berkas.created_at,
            toko: masterScope,
        };
    },

    async createPdfSerahTerimaForMigration(idToko: number) {
        const { toko, opnameFinal, items } = await buildDetailByTokoId(idToko);
        if (items.length === 0) {
            throw new AppError("Data opname_item kosong untuk toko ini", 409);
        }

        const placeholder = await serahTerimaRepository.ensureBerkasSerahTerima(idToko);

        await opnameFinalService.refreshDendaByTokoId(idToko);

        const detail = { toko, opname_final: opnameFinal, items };
        const pdfBuffer = await buildSerahTerimaPdfBuffer(detail, placeholder.created_at);

        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");
        const filename = `SERAH_TERIMA_MIGRASI_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`;

        const linkPdf = await uploadPdfToDrive(pdfBuffer, filename);
        const berkas = await serahTerimaRepository.updateBerkasSerahTerimaLink(placeholder.id, linkPdf);

        await opnameFinalService.refreshDendaAndPdfById(String(opnameFinal.id));

        return {
            id: berkas.id,
            id_toko: idToko,
            link_pdf: linkPdf,
            opname_final_id: opnameFinal.id,
            link_pdf_opname: opnameFinal.link_pdf_opname,
            item_count: items.length,
            created_at: berkas.created_at,
            toko,
        };
    },

    async downloadPdfByBerkasId(id: number) {
        const berkas = await serahTerimaRepository.findBerkasSerahTerimaById(id);
        if (!berkas) {
            throw new AppError("Berkas serah terima tidak ditemukan", 404);
        }

        const toko = await serahTerimaRepository.findTokoById(berkas.id_toko);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");
        const opnameFinal = await serahTerimaRepository.findOpnameFinalByIdToko(berkas.id_toko);

        if (toko.nomor_ulok) {
            const scopes = await serahTerimaRepository.findTokoScopesByNomorUlok(toko.nomor_ulok);
            const activeScopes = scopes.filter((scope) =>
                ["SIPIL", "ME"].includes(String(scope.lingkup_pekerjaan || "").trim().toUpperCase())
            );
            const hasSipil = activeScopes.some((scope) => String(scope.lingkup_pekerjaan || "").trim().toUpperCase() === "SIPIL");
            const hasMe = activeScopes.some((scope) => String(scope.lingkup_pekerjaan || "").trim().toUpperCase() === "ME");

            if (hasSipil && hasMe) {
                const activeBerkasRows = await Promise.all(
                    activeScopes.map((scope) => serahTerimaRepository.findBerkasSerahTerimaByIdToko(scope.id))
                );
                const sharedLinks = new Set(
                    activeBerkasRows
                        .map((row) => row?.link_pdf ?? null)
                        .filter((link): link is string => Boolean(link))
                );

                if (
                    activeBerkasRows.length === activeScopes.length
                    && activeBerkasRows.every((row) => Boolean(row?.link_pdf))
                    && sharedLinks.size === 1
                ) {
                    const unifiedBuffer = await downloadStoredPdfBuffer(activeBerkasRows[0]?.link_pdf);
                    if (unifiedBuffer) {
                        return {
                            buffer: unifiedBuffer,
                            filename: `SERAH_TERIMA_UNIFIED_${proyek}_${nomorUlok}.pdf`,
                        };
                    }
                }

                const readiness = await Promise.all(activeScopes.map((scope) => getSerahTerimaReadiness(scope.id)));
                if (readiness.every((item) => item.ready)) {
                    const regenerated = await serahTerimaService.createPdfSerahTerimaUnified(toko.nomor_ulok);
                    const unifiedBuffer = await downloadStoredPdfBuffer(regenerated.link_pdf);
                    if (unifiedBuffer) {
                        return {
                            buffer: unifiedBuffer,
                            filename: `SERAH_TERIMA_UNIFIED_${proyek}_${nomorUlok}.pdf`,
                        };
                    }
                }
            }
        }

        if (opnameFinal) {
            const items = await serahTerimaRepository.findOpnameItemsByOpnameFinalId(opnameFinal.id);
            const buffer = await buildSerahTerimaPdfBuffer({ toko, opname_final: opnameFinal, items }, berkas.created_at);

            return {
                buffer,
                filename: `SERAH_TERIMA_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`,
            };
        }

        if (!berkas.link_pdf) {
            throw new AppError("Data opname_final tidak ditemukan dan link PDF tidak tersedia", 404);
        }

        const buffer = await downloadStoredPdfBuffer(berkas.link_pdf);

        if (!buffer || buffer.length === 0) {
            throw new AppError("Gagal mengunduh file PDF Serah Terima dari Google Drive", 500);
        }

        return {
            buffer,
            filename: `SERAH_TERIMA_${proyek}_${nomorUlok}_MIGRATED.pdf`,
        };
    },

    async regeneratePdfByBerkasId(id: number) {
        const berkas = await serahTerimaRepository.findBerkasSerahTerimaById(id);
        if (!berkas) {
            throw new AppError("Berkas serah terima tidak ditemukan", 404);
        }

        const opnameFinal = await serahTerimaRepository.findOpnameFinalByIdToko(berkas.id_toko);
        if (!opnameFinal) {
            throw new AppError("Dokumen hasil migrasi tidak dapat diregenerasi karena tidak memiliki data transaksi digital", 400);
        }

        const { toko, items } = await buildDetailByTokoId(berkas.id_toko);

        // Jika toko memiliki nomor_ulok, periksa apakah ini perlu Unified PDF (SIPIL + ME)
        if (toko.nomor_ulok) {
            const scopes = await serahTerimaRepository.findTokoScopesByNomorUlok(toko.nomor_ulok);
            const activeScopes = scopes.filter((scope) =>
                ["SIPIL", "ME"].includes(String(scope.lingkup_pekerjaan || "").trim().toUpperCase())
            );
            
            const hasSipil = activeScopes.some((scope) => String(scope.lingkup_pekerjaan || "").trim().toUpperCase() === "SIPIL");
            const hasMe = activeScopes.some((scope) => String(scope.lingkup_pekerjaan || "").trim().toUpperCase() === "ME");

            if (hasSipil && hasMe) {
                // Generate ulang versi Unified yang akan otomatis meng-update link_pdf kedua scope
                await module.exports.serahTerimaService.createPdfSerahTerimaUnified(toko.nomor_ulok);
                
                // Ambil ulang berkas yang sudah terupdate link-nya
                const updatedBerkas = await serahTerimaRepository.findBerkasSerahTerimaById(id);
                return {
                    ...updatedBerkas,
                    opname_final_id: opnameFinal.id,
                    item_count: items.length,
                };
            }
        }

        await opnameFinalService.refreshDendaByTokoId(berkas.id_toko);

        const pdfBuffer = await buildSerahTerimaPdfBuffer(
            { toko, opname_final: opnameFinal, items },
            berkas.created_at
        );
        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");
        const filename = `SERAH_TERIMA_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`;
        const linkPdf = await uploadPdfToDrive(pdfBuffer, filename);
        const updated = await serahTerimaRepository.updateBerkasSerahTerimaLink(berkas.id, linkPdf);
        await opnameFinalService.refreshDendaAndPdfById(String(opnameFinal.id));

        return {
            ...updated,
            opname_final_id: opnameFinal.id,
            item_count: items.length,
        };
    },
};
