import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
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

export const serahTerimaService = {
    async list(filter: { id_toko?: number; nomor_ulok?: string } = {}) {
        const rows = await serahTerimaRepository.listBerkasSerahTerima({
            id_toko: filter.id_toko,
            nomor_ulok: filter.nomor_ulok,
        });

        return rows.map((row) => ({
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
        }));
    },

    async createPdfSerahTerima(idToko: number, tanggalAktual?: string) {
        if (tanggalAktual) {
            await serahTerimaRepository.upsertTanggalAktual(idToko, tanggalAktual);
        }

        // 1. Refresh denda HANYA dengan tanggal terbaru di berkas
        const refreshedOpnameFinal = await opnameFinalService.refreshDendaByTokoId(idToko);

        const { toko, opnameFinal, items } = await buildDetailByTokoId(idToko);
        const detail = { toko, opname_final: opnameFinal, items };
        const pdfBuffer = await buildSerahTerimaPdfBuffer(detail, tanggalAktual);

        // 5. Upload ke Google Drive
        const proyek = sanitizeFilenamePart(toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(toko.nomor_ulok ?? undefined, "ULOK");
        const filename = `SERAH_TERIMA_${proyek}_${nomorUlok}_${opnameFinal.id}.pdf`;

        const linkPdf = await uploadPdfToDrive(pdfBuffer, filename);

        // 6. Simpan link di tabel berkas_serah_terima
        const berkas = await serahTerimaRepository.upsertBerkasSerahTerima(idToko, linkPdf, tanggalAktual);

        // 7. Regenerate Opname Final PDF since penalty was updated
        const opnameFinalRefreshed = await opnameFinalService.refreshDendaAndPdfById(String(opnameFinal.id));

        return {
            id: berkas.id,
            id_toko: idToko,
            link_pdf: linkPdf,
            opname_final_id: opnameFinal.id,
            link_pdf_opname: opnameFinalRefreshed.link_pdf_opname,
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
};
