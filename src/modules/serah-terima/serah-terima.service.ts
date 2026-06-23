import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { calculateDendaByTokoId } from "../denda/denda-keterlambatan";
import { opnameFinalService } from "../opname-final/opname-final.service";
import { buildSerahTerimaPdfBuffer } from "./serah-terima.pdf";
import { serahTerimaRepository } from "./serah-terima.repository";

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
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

const automaticSerahTerimaInProgress = new Set<number>();

export const scheduleAutomaticSerahTerimaIfReady = async (idToko: number): Promise<void> => {
    if (automaticSerahTerimaInProgress.has(idToko)) return;

    const existing = await serahTerimaRepository.findBerkasSerahTerimaByIdToko(idToko);
    if (existing?.link_pdf) return;

    const opnameFinal = await serahTerimaRepository.findOpnameFinalByIdToko(idToko);
    if (!opnameFinal) return;

    const latestStatuses = await pool.query<{ total: number; unfinished: number }>(
        `
        WITH latest_gantt AS (
            SELECT id
            FROM gantt_chart
            WHERE id_toko = $1
            ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id DESC
            LIMIT 1
        ),
        latest_item AS (
            SELECT DISTINCT ON (
                UPPER(TRIM(p.kategori_pekerjaan)),
                UPPER(TRIM(p.jenis_pekerjaan))
            )
                p.status
            FROM pengawasan p
            JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            JOIN latest_gantt g ON g.id = p.id_gantt
            ORDER BY
                UPPER(TRIM(p.kategori_pekerjaan)),
                UPPER(TRIM(p.jenis_pekerjaan)),
                pg.id DESC,
                p.id DESC
        )
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) <> 'selesai')::int AS unfinished
        FROM latest_item
        `,
        [idToko]
    );
    const status = latestStatuses.rows[0];
    if (!status || Number(status.total) === 0 || Number(status.unfinished) > 0) return;

    automaticSerahTerimaInProgress.add(idToko);
    setImmediate(() => {
        serahTerimaService
            .createPdfSerahTerima(idToko)
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
    async list(filter: { id_toko?: number; nomor_ulok?: string } = {}) {
        const rows = await serahTerimaRepository.listBerkasSerahTerima({
            id_toko: filter.id_toko,
            nomor_ulok: filter.nomor_ulok,
        });

        // For rows that have no opname_final (hari_denda is null),
        // compute denda on-the-fly using the same peer-minimum logic as the dashboard.
        // This ensures the serah terima list stays in sync with the dashboard's denda display.
        const enriched = await Promise.all(
            rows.map(async (row) => {
                let hariDenda = row.hari_denda;
                let nilaiDenda = row.nilai_denda;
                let tanggalAkhirSpkDenda = row.tanggal_akhir_spk_denda;
                let tanggalSerahTerimaDenda = row.tanggal_serah_terima_denda;

                // Only calculate on-the-fly when no official denda has been stored yet
                if (hariDenda === null && tanggalAkhirSpkDenda === null) {
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


    async createPdfSerahTerima(idToko: number) {
        // Validate the required opname data before writing a serah-terima placeholder.
        // Previously, a failed generation could leave a row with link_pdf = NULL.
        await buildDetailByTokoId(idToko);

        const placeholder = await serahTerimaRepository.ensureBerkasSerahTerima(idToko);

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
        //    yang opname-nya sudah Disetujui tapi belum punya berkas_serah_terima.
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
                })
                .catch((err) => {
                    console.error(`[ST Cascade] Gagal query sibling tokos: ${err?.message ?? err}`);
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

    async downloadPdfByBerkasId(id: number) {
        const berkas = await serahTerimaRepository.findBerkasSerahTerimaById(id);
        if (!berkas) {
            throw new AppError("Berkas serah terima tidak ditemukan", 404);
        }

        const { toko, opnameFinal, items } = await buildDetailByTokoId(berkas.id_toko);
        const buffer = await buildSerahTerimaPdfBuffer({ toko, opname_final: opnameFinal, items }, berkas.created_at);
        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");

        return {
            buffer,
            filename: `SERAH_TERIMA_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`,
        };
    },

    async regeneratePdfByBerkasId(id: number) {
        const berkas = await serahTerimaRepository.findBerkasSerahTerimaById(id);
        if (!berkas) {
            throw new AppError("Berkas serah terima tidak ditemukan", 404);
        }

        await opnameFinalService.refreshDendaByTokoId(berkas.id_toko);

        const { toko, opnameFinal, items } = await buildDetailByTokoId(berkas.id_toko);
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
