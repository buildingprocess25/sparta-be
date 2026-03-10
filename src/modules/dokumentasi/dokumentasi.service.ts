import fs from "fs";
import path from "path";
import { AppError } from "../../common/app-error";
import { env } from "../../config/env";
import { GoogleProvider, withGoogleRetry } from "../../common/google";
import { decodeBase64MaybeWithPrefix } from "../document/document.constants";
import type {
    LoginDokumentasiInput,
    SpkDataInput,
    SaveTempInput,
    GetTempInput,
    CekStatusInput,
    SaveTokoInput,
    SendPdfEmailInput,
    ValidateQueryInput,
} from "./dokumentasi.schema";

const LOGIN_ALLOWED_ROLES = [
    "BRANCH BUILDING SUPPORT",
    "BRANCH BUILDING COORDINATOR",
    "BRANCH BUILDING & MAINTENANCE MANAGER",
];

const VALIDATOR_ROLES = [
    "BRANCH BUILDING COORDINATOR",
    "BRANCH BUILDING & MAINTENANCE MANAGER",
];

function getProvider(): GoogleProvider {
    return GoogleProvider.instance;
}

function toYmd(val: unknown): string {
    if (!val) return "";
    const str = String(val).replace("Z", "");
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(val));
    return m ? m[1] : String(val);
}

function extractFileIdFromUrl(url: string): string | null {
    if (!url) return null;
    const byPath = /\/d\/([A-Za-z0-9_-]+)/.exec(url);
    if (byPath) return byPath[1];
    const byQuery = /[?&]id=([A-Za-z0-9_-]+)/.exec(url);
    if (byQuery) return byQuery[1];
    if (/^[A-Za-z0-9_-]{20,}$/.test(url)) return url;
    return null;
}

function driveFilePublicUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

function getColLetter(colNum: number): string {
    let col = colNum;
    let out = "";
    while (col > 0) {
        const rem = (col - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        col = Math.floor((col - 1) / 26);
    }
    return out;
}

async function uploadDocImageOverwrite(base64Data: string, filename: string): Promise<string | null> {
    const provider = getProvider();
    if (!provider.docDrive) return null;

    const oldFiles = await withGoogleRetry(
        () => provider.listFilesByNameInFolder(env.DOC_BANGUNAN_DRIVE_FOLDER_ID, filename),
        "dok_list_existing_file",
    );

    for (const f of oldFiles) {
        await provider.deleteDriveFile(f.id);
    }

    const raw = decodeBase64MaybeWithPrefix(base64Data);
    const uploaded = await withGoogleRetry(
        () => provider.uploadFile(env.DOC_BANGUNAN_DRIVE_FOLDER_ID, filename, "image/jpeg", raw),
        "dok_upload_image",
    );

    return uploaded.id ?? null;
}

async function uploadDocFileOverwrite(base64Data: string, filename: string, mimeType: string): Promise<string | null> {
    const provider = getProvider();
    if (!provider.docDrive) return null;

    const oldFiles = await withGoogleRetry(
        () => provider.listFilesByNameInFolder(env.DOC_BANGUNAN_DRIVE_FOLDER_ID, filename),
        "dok_list_existing_any_file",
    );

    for (const f of oldFiles) {
        await provider.deleteDriveFile(f.id);
    }

    const raw = decodeBase64MaybeWithPrefix(base64Data);
    const uploaded = await withGoogleRetry(
        () => provider.uploadFile(env.DOC_BANGUNAN_DRIVE_FOLDER_ID, filename, mimeType, raw),
        "dok_upload_file",
    );

    return uploaded.id ?? null;
}

async function readSheetRows(sheetName: string): Promise<string[][]> {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);
    return withGoogleRetry(
        () => provider.getAllValues(provider.docSheets!, env.DOC_BANGUNAN_SPREADSHEET_ID, sheetName),
        "dok_read_sheet",
    );
}

async function appendRow(sheetName: string, row: unknown[]): Promise<void> {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);
    await withGoogleRetry(
        () => provider.appendRow(provider.docSheets!, env.DOC_BANGUNAN_SPREADSHEET_ID, sheetName, row),
        "dok_append_row",
    );
}

async function updateRow(sheetName: string, rowIndex: number, row: unknown[]): Promise<void> {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);
    const lastCol = getColLetter(row.length || 1);
    const range = `A${rowIndex}:${lastCol}${rowIndex}`;
    await withGoogleRetry(
        () => provider.updateRow(provider.docSheets!, env.DOC_BANGUNAN_SPREADSHEET_ID, sheetName, range, row),
        "dok_update_row",
    );
}

function getHeaderIndex(headers: string[], name: string): number {
    return headers.findIndex((h) => h === name);
}

function parsePhotoIndex(photoId: unknown): number | null {
    if (photoId === undefined || photoId === null || photoId === "") return null;
    const n = Number(photoId);
    if (!Number.isFinite(n) || n < 1 || n > 38) return null;
    return Math.floor(n);
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildRawEmail(to: string, subject: string, htmlBody: string, attachment?: { filename: string; contentBase64: string; mimeType: string }) {
    const boundary = `sparta-${Date.now()}`;
    const parts: string[] = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        htmlBody,
    ];

    if (attachment) {
        parts.push(
            `--${boundary}`,
            `Content-Type: ${attachment.mimeType}; name=\"${attachment.filename}\"`,
            "Content-Transfer-Encoding: base64",
            `Content-Disposition: attachment; filename=\"${attachment.filename}\"`,
            "",
            attachment.contentBase64,
        );
    }

    parts.push(`--${boundary}--`, "");
    const mimeMessage = parts.join("\r\n");
    return Buffer.from(mimeMessage).toString("base64url");
}

export async function loginDokumentasi(input: LoginDokumentasiInput) {
    const provider = getProvider();
    if (!provider.spartaSheets) throw new AppError("Service Sparta belum siap", 500);

    const username = (input.username ?? "").trim().toLowerCase();
    const password = (input.password ?? "").trim().toUpperCase();

    const rows = await withGoogleRetry(
        () => provider.getAllValues(provider.spartaSheets!, env.SPREADSHEET_ID, env.CABANG_SHEET_NAME),
        "dok_login_read_cabang",
    );

    if (!rows.length) throw new AppError("Sheet Cabang Kosong", 400);

    const headers = rows[0];
    const emailIdx = getHeaderIndex(headers, "EMAIL_SAT");
    const cabangIdx = getHeaderIndex(headers, "CABANG");
    const jabatanIdx = getHeaderIndex(headers, "JABATAN");
    const namaIdx = getHeaderIndex(headers, "NAMA LENGKAP");

    if ([emailIdx, cabangIdx, jabatanIdx, namaIdx].some((x) => x < 0)) {
        throw new AppError("Header Sheet Cabang tidak sesuai", 500);
    }

    for (const r of rows.slice(1)) {
        const email = String(r[emailIdx] ?? "").trim().toLowerCase();
        const cabang = String(r[cabangIdx] ?? "").trim().toUpperCase();
        const jabatan = String(r[jabatanIdx] ?? "").trim().toUpperCase();
        const nama = String(r[namaIdx] ?? "").trim();

        if (email === username && cabang === password) {
            if (LOGIN_ALLOWED_ROLES.includes(jabatan)) {
                return {
                    ok: true,
                    message: "Login berhasil",
                    user: { email, cabang, nama, jabatan },
                };
            }
            throw new AppError("Jabatan tidak diizinkan", 403);
        }
    }

    throw new AppError("Username atau password salah", 401);
}

export async function spkData(input: SpkDataInput) {
    const provider = getProvider();
    if (!provider.spartaSheets) throw new AppError("Service Sparta belum siap", 500);

    const cabangFilter = (input.cabang ?? "").trim();

    const rows = await withGoogleRetry(
        () => provider.getAllValues(provider.spartaSheets!, env.DOC_BANGUNAN_SPREADSHEET_ID, env.SPK_DATA_SHEET_NAME),
        "dok_spk_read_sheet",
    );

    if (!rows.length) return { ok: true, data: [] };

    const headers = rows[0];
    const idx = (name: string) => getHeaderIndex(headers, name);

    const nomorIdx = idx("Nomor Ulok");
    const cabangIdx = idx("Cabang");
    const sipilIdx = idx("Nama Kontraktor");
    const awalIdx = idx("Waktu Mulai");
    const akhirIdx = idx("Waktu Selesai");
    const namaTokoIdx = idx("Nama_Toko");

    const contractorCols = headers.map((h, i) => ({ h, i })).filter((x) => x.h === "Nama Kontraktor").map((x) => x.i);
    const meIdx = contractorCols.length >= 2 ? contractorCols[contractorCols.length - 1] : sipilIdx;

    const out = [] as Array<Record<string, string>>;
    for (const r of rows.slice(1)) {
        const currCabang = cabangIdx >= 0 ? String(r[cabangIdx] ?? "") : "";
        if (cabangFilter && currCabang.trim() !== cabangFilter) continue;

        out.push({
            nomorUlok: nomorIdx >= 0 ? String(r[nomorIdx] ?? "") : "",
            cabang: currCabang,
            kontraktorSipil: sipilIdx >= 0 ? String(r[sipilIdx] ?? "") : "",
            kontraktorMe: meIdx >= 0 ? String(r[meIdx] ?? "") : "",
            spkAwal: awalIdx >= 0 ? toYmd(r[awalIdx]) : "",
            spkAkhir: akhirIdx >= 0 ? toYmd(r[akhirIdx]) : "",
            namaToko: namaTokoIdx >= 0 ? String(r[namaTokoIdx] ?? "") : "",
        });
    }

    return { ok: true, data: out };
}

export async function viewPhoto(fileId: string): Promise<Buffer | null> {
    const provider = getProvider();

    if (provider.docDrive) {
        const byDoc = await provider.getFileBufferById(provider.docDrive, fileId);
        if (byDoc) return byDoc;
    }

    if (provider.spartaDrive) {
        const bySparta = await provider.getFileBufferById(provider.spartaDrive, fileId);
        if (bySparta) return bySparta;
    }

    return null;
}

export async function saveTemp(input: SaveTempInput) {
    const nomorUlok = (input.nomorUlok ?? "").trim();
    if (!nomorUlok) throw new AppError("nomorUlok required", 400);

    const sheetName = env.DOC_BANGUNAN_SHEET_TEMP;
    let rows = await readSheetRows(sheetName);

    if (!rows.length) {
        const headers = [
            "Timestamp", "Nomor Ulok", "Nama Toko", "Kode Toko", "Cabang",
            "Tanggal GO", "Tanggal ST", "Tanggal Ambil Foto", "SPK Awal", "SPK Akhir",
            "Kontraktor Sipil", "Kontraktor ME", "Email Pengirim",
            ...Array.from({ length: 38 }, (_v, i) => `Photo${i + 1}`),
        ];
        await appendRow(sheetName, headers);
        rows = [headers];
    }

    const headers = rows[0];
    const nomorIdx = getHeaderIndex(headers, "Nomor Ulok");
    if (nomorIdx < 0) throw new AppError("Header Sheet Temp Salah", 500);

    let foundRowIdx: number | null = null;
    let oldData: string[] = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[nomorIdx] ?? "").trim() === nomorUlok) {
            foundRowIdx = i + 1;
            oldData = r;
            break;
        }
    }

    if (!oldData.length) oldData = Array(headers.length).fill("");

    const photoId = parsePhotoIndex(input.photoId);
    const photoNote = (input.photoNote ?? "").trim().toUpperCase();
    let photoCellValue = "";

    if (input.photoBase64 && photoId !== null) {
        const fid = await uploadDocImageOverwrite(input.photoBase64, `${nomorUlok}_foto_${photoId}.jpg`);
        if (fid) photoCellValue = driveFilePublicUrl(fid);
    } else if (photoNote === "TIDAK BISA DIFOTO" && photoId !== null) {
        try {
            const defaultPath = path.resolve(__dirname, "../../../../server/static/fototidakbisadiambil.jpeg");
            if (fs.existsSync(defaultPath)) {
                const raw = fs.readFileSync(defaultPath);
                const base64Default = `data:image/jpeg;base64,${raw.toString("base64")}`;
                const fid = await uploadDocImageOverwrite(base64Default, `${nomorUlok}_foto_${photoId}.jpg`);
                if (fid) {
                    photoCellValue = driveFilePublicUrl(fid);
                } else {
                    photoCellValue = driveFilePublicUrl(env.DOC_BANGUNAN_DEFAULT_PHOTO_ID);
                }
            } else {
                photoCellValue = driveFilePublicUrl(env.DOC_BANGUNAN_DEFAULT_PHOTO_ID);
            }
        } catch {
            photoCellValue = driveFilePublicUrl(env.DOC_BANGUNAN_DEFAULT_PHOTO_ID);
        }
    } else if (photoId !== null) {
        const photoStartIdx = getHeaderIndex(headers, "Photo1") >= 0 ? getHeaderIndex(headers, "Photo1") : 13;
        const oldIdx = photoStartIdx + (photoId - 1);
        photoCellValue = String(oldData[oldIdx] ?? "");
    }

    const newRow: string[] = Array(headers.length).fill("");
    const fixedMap: Record<string, string> = {
        "Timestamp": new Date().toISOString(),
        "Nomor Ulok": nomorUlok,
        "Nama Toko": input.namaToko,
        "Kode Toko": input.kodeToko,
        "Cabang": (input.cabang ?? "").trim(),
        "Tanggal GO": input.tanggalGo,
        "Tanggal ST": input.tanggalSt,
        "Tanggal Ambil Foto": input.tanggalAmbilFoto,
        "SPK Awal": input.spkAwal,
        "SPK Akhir": input.spkAkhir,
        "Kontraktor Sipil": input.kontraktorSipil,
        "Kontraktor ME": input.kontraktorMe,
        "Email Pengirim": input.emailPengirim,
    };

    for (const [h, v] of Object.entries(fixedMap)) {
        const i = getHeaderIndex(headers, h);
        if (i >= 0) {
            newRow[i] = v || String(oldData[i] ?? "");
        }
    }

    const photoStartIdx = getHeaderIndex(headers, "Photo1") >= 0 ? getHeaderIndex(headers, "Photo1") : 13;
    for (let i = 1; i <= 38; i++) {
        const colIdx = photoStartIdx + (i - 1);
        if (colIdx >= newRow.length) {
            newRow.push(...Array(colIdx - newRow.length + 1).fill(""));
        }
        if (photoId !== null && i === photoId) {
            newRow[colIdx] = photoCellValue;
        } else {
            newRow[colIdx] = String(oldData[colIdx] ?? "");
        }
    }

    if (foundRowIdx) {
        await updateRow(sheetName, foundRowIdx, newRow);
    } else {
        await appendRow(sheetName, newRow);
    }

    return { ok: true, message: "Temp saved" };
}

export async function getTemp(input: GetTempInput) {
    const nomorUlok = (input.nomorUlok ?? "").trim();
    const rows = await readSheetRows(env.DOC_BANGUNAN_SHEET_TEMP);
    if (!rows.length) return { ok: false, message: "Sheet kosong" };

    const headers = rows[0];
    const nomorIdx = getHeaderIndex(headers, "Nomor Ulok");
    if (nomorIdx < 0) return { ok: false, message: "Kolom Nomor Ulok tidak ada" };

    let found: string[] | null = null;
    for (const r of rows.slice(1)) {
        if (String(r[nomorIdx] ?? "").trim() === nomorUlok) {
            found = r;
            break;
        }
    }

    if (!found) return { ok: true, data: null };

    const dataMap: Record<string, string> = {};
    headers.forEach((h, i) => {
        dataMap[h] = String(found![i] ?? "");
    });

    const photoIds: string[] = [];
    const startIdx = getHeaderIndex(headers, "Photo1") >= 0 ? getHeaderIndex(headers, "Photo1") : 13;
    for (let i = 0; i < 38; i++) {
        const colIdx = startIdx + i;
        const rawVal = String(found[colIdx] ?? "");
        if (rawVal) {
            photoIds.push(extractFileIdFromUrl(rawVal) || rawVal);
        } else {
            photoIds.push("");
        }
    }

    const result: Record<string, unknown> = {
        nomorUlok: dataMap["Nomor Ulok"] ?? "",
        namaToko: dataMap["Nama Toko"] ?? "",
        kodeToko: dataMap["Kode Toko"] ?? "",
        cabang: dataMap["Cabang"] ?? "",
        tanggalGo: toYmd(dataMap["Tanggal GO"] ?? ""),
        tanggalSt: toYmd(dataMap["Tanggal ST"] ?? ""),
        tanggalAmbilFoto: toYmd(dataMap["Tanggal Ambil Foto"] ?? ""),
        spkAwal: toYmd(dataMap["SPK Awal"] ?? ""),
        spkAkhir: toYmd(dataMap["SPK Akhir"] ?? ""),
        kontraktorSipil: dataMap["Kontraktor Sipil"] ?? "",
        kontraktorMe: dataMap["Kontraktor ME"] ?? "",
        emailPengirim: dataMap["Email Pengirim"] ?? "",
        photos: photoIds,
    };

    Object.assign(result, dataMap);
    result.photos = photoIds;

    return { ok: true, data: result };
}

export async function cekStatus(input: CekStatusInput) {
    const ulok = (input.nomorUlok ?? "").trim();
    const rows = await readSheetRows(env.DOC_BANGUNAN_SHEET_FINAL);
    if (!rows.length) return { ok: true, status: "BELUM ADA" };

    const headers = rows[0];
    const ulokIdx = getHeaderIndex(headers, "Nomor Ulok");
    const statusIdx = getHeaderIndex(headers, "Status Validasi");
    if (ulokIdx < 0 || statusIdx < 0) return { ok: true, status: "BELUM ADA" };

    for (const r of rows.slice(1)) {
        if (String(r[ulokIdx] ?? "").trim() === ulok) {
            const status = String(r[statusIdx] ?? "").trim().toUpperCase();
            return { ok: true, status };
        }
    }

    return { ok: true, status: "BELUM ADA" };
}

export async function saveToko(input: SaveTokoInput) {
    const nomorUlok = (input.nomorUlok ?? "").trim();
    if (!nomorUlok) throw new AppError("nomorUlok required", 400);

    const sheetName = env.DOC_BANGUNAN_SHEET_FINAL;
    let rows = await readSheetRows(sheetName);

    if (!rows.length) {
        const headers = [
            "Timestamp", "Nomor Ulok", "Nama Toko", "Kode Toko", "Cabang",
            "Tanggal GO", "Tanggal ST", "Tanggal Ambil Foto", "SPK Awal", "SPK Akhir",
            "Kontraktor Sipil", "Kontraktor ME", "Email Pengirim", "Link PDF",
            "Status Validasi", "Validator", "Waktu Validasi", "Catatan Revisi",
            ...Array.from({ length: 38 }, (_v, i) => `Photo${i + 1}`),
        ];
        await appendRow(sheetName, headers);
        rows = [headers];
    }

    const headers = rows[0];
    const nomorIdx = getHeaderIndex(headers, "Nomor Ulok");
    if (nomorIdx < 0) throw new AppError("Header Sheet Final tidak valid", 500);

    let foundRowIdx: number | null = null;
    let oldData: string[] = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[nomorIdx] ?? "").trim() === nomorUlok) {
            foundRowIdx = i + 1;
            oldData = r;
            break;
        }
    }

    if (!oldData.length) oldData = Array(headers.length).fill("");

    let pdfUrl = "";
    if (input.pdfBase64) {
        const pdfFileId = await uploadDocFileOverwrite(input.pdfBase64, `${nomorUlok}_dokumentasi.pdf`, "application/pdf");
        if (pdfFileId) pdfUrl = `https://drive.google.com/file/d/${pdfFileId}/view`;
    }

    const photoUrls: string[] = [];
    for (let i = 0; i < input.photosBase64.length; i++) {
        const photoB64 = input.photosBase64[i];
        if (photoB64) {
            const fid = await uploadDocImageOverwrite(photoB64, `${nomorUlok}_foto_${i + 1}.jpg`);
            photoUrls.push(fid ? driveFilePublicUrl(fid) : "");
        } else {
            photoUrls.push("");
        }
    }

    const existingPhotoUrls = input.photoUrls || [];
    const newRow: string[] = Array(headers.length).fill("");

    const fixedMap: Record<string, string> = {
        "Timestamp": new Date().toISOString(),
        "Nomor Ulok": nomorUlok,
        "Nama Toko": input.namaToko,
        "Kode Toko": input.kodeToko,
        "Cabang": (input.cabang ?? "").trim(),
        "Tanggal GO": input.tanggalGo,
        "Tanggal ST": input.tanggalSt,
        "Tanggal Ambil Foto": input.tanggalAmbilFoto,
        "SPK Awal": input.spkAwal,
        "SPK Akhir": input.spkAkhir,
        "Kontraktor Sipil": input.kontraktorSipil,
        "Kontraktor ME": input.kontraktorMe,
        "Email Pengirim": input.emailPengirim,
        "Link PDF": pdfUrl,
        "Status Validasi": input.statusValidasi || "MENUNGGU VALIDASI",
        "Validator": input.validator,
        "Waktu Validasi": input.waktuValidasi,
        "Catatan Revisi": input.catatanRevisi,
    };

    for (const [h, v] of Object.entries(fixedMap)) {
        const i = getHeaderIndex(headers, h);
        if (i >= 0) {
            if (h === "Timestamp") {
                newRow[i] = v;
            } else {
                newRow[i] = v || String(oldData[i] ?? "");
            }
        }
    }

    const photoStartIdx = getHeaderIndex(headers, "Photo1") >= 0 ? getHeaderIndex(headers, "Photo1") : 18;
    for (let i = 0; i < 38; i++) {
        const colIdx = photoStartIdx + i;
        if (colIdx >= newRow.length) {
            newRow.push(...Array(colIdx - newRow.length + 1).fill(""));
        }

        if (i < photoUrls.length && photoUrls[i]) {
            newRow[colIdx] = photoUrls[i];
        } else if (i < existingPhotoUrls.length && existingPhotoUrls[i]) {
            newRow[colIdx] = existingPhotoUrls[i];
        } else {
            newRow[colIdx] = String(oldData[colIdx] ?? "");
        }
    }

    if (foundRowIdx) {
        await updateRow(sheetName, foundRowIdx, newRow);
    } else {
        await appendRow(sheetName, newRow);
    }

    if (input.deleteTemp) {
        try {
            const tempRows = await readSheetRows(env.DOC_BANGUNAN_SHEET_TEMP);
            for (let i = 1; i < tempRows.length; i++) {
                const r = tempRows[i];
                if (String(r[1] ?? "").trim() === nomorUlok) {
                    await updateRow(env.DOC_BANGUNAN_SHEET_TEMP, i + 1, Array(r.length).fill(""));
                    break;
                }
            }
        } catch {
            // keep non-blocking, same behavior as Python warning
        }
    }

    return {
        ok: true,
        message: "Data dokumentasi berhasil disimpan",
        pdfUrl,
        nomorUlok,
    };
}

export async function sendPdfEmail(input: SendPdfEmailInput, baseUrl: string) {
    const provider = getProvider();
    if (!provider.spartaSheets) throw new AppError("Service Sparta belum siap", 500);
    if (!provider.spartaGmail) throw new AppError("Service Gmail belum siap", 500);

    const nomorUlok = (input.nomorUlok ?? "").trim();
    const cabang = (input.cabang ?? "").trim();
    const namaToko = input.namaToko ?? "";
    const pdfUrl = input.pdfUrl ?? "";
    const emailPengirim = input.emailPengirim ?? "";

    const rows = await withGoogleRetry(
        () => provider.getAllValues(provider.spartaSheets!, env.SPREADSHEET_ID, env.CABANG_SHEET_NAME),
        "dok_email_read_cabang",
    );

    if (!rows.length) throw new AppError("Sheet Cabang kosong", 400);

    const headers = rows[0];
    const emailIdx = getHeaderIndex(headers, "EMAIL_SAT");
    const cabangIdx = getHeaderIndex(headers, "CABANG");
    const jabatanIdx = getHeaderIndex(headers, "JABATAN");

    if ([emailIdx, cabangIdx, jabatanIdx].some((x) => x < 0)) {
        throw new AppError("Header Sheet Cabang tidak lengkap", 500);
    }

    const validatorEmails: string[] = [];
    for (const r of rows.slice(1)) {
        const rowCabang = String(r[cabangIdx] ?? "").trim().toUpperCase();
        const rowJabatan = String(r[jabatanIdx] ?? "").trim().toUpperCase();
        const rowEmail = String(r[emailIdx] ?? "").trim();

        if (rowCabang === cabang.toUpperCase() && VALIDATOR_ROLES.includes(rowJabatan) && rowEmail.includes("@")) {
            validatorEmails.push(rowEmail);
        }
    }

    if (!validatorEmails.length) {
        throw new AppError(`Tidak ditemukan validator untuk cabang ${cabang}`, 400);
    }

    const subject = `[Dokumentasi Bangunan] Permintaan Validasi - ${nomorUlok} - ${namaToko}`;
    const validateUrl = `${baseUrl}/api/dok/validate?ulok=${encodeURIComponent(nomorUlok)}&status=VALID`;
    const revisiUrl = `${baseUrl}/api/dok/validate?ulok=${encodeURIComponent(nomorUlok)}&status=REVISI`;

    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2 style="color: #2c3e50;">Permintaan Validasi Dokumentasi Bangunan</h2>
    <p>Yth. Validator,</p>
    <p>Berikut adalah detail dokumentasi bangunan yang memerlukan validasi:</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Nomor Ulok</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(nomorUlok)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Nama Toko</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(namaToko)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cabang</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(cabang)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Pengirim</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(emailPengirim)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Link PDF</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${escapeHtml(pdfUrl)}">${escapeHtml(pdfUrl)}</a></td></tr>
    </table>
    <p>Silakan klik tombol di bawah untuk melakukan validasi:</p>
    <div style="margin: 20px 0;">
        <a href="${validateUrl}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">VALIDASI</a>
        <a href="${revisiUrl}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">MINTA REVISI</a>
    </div>
</body>
</html>`;

    const attachment = input.pdfBase64
        ? {
            filename: `Dokumentasi_${nomorUlok}.pdf`,
            contentBase64: input.pdfBase64.includes(",") ? input.pdfBase64.split(",").pop()! : input.pdfBase64,
            mimeType: "application/pdf",
        }
        : undefined;

    const sentTo: string[] = [];
    const errors: string[] = [];

    for (const emailTo of validatorEmails) {
        try {
            const raw = buildRawEmail(emailTo, subject, htmlBody, attachment);
            await provider.spartaGmail.users.messages.send({
                userId: "me",
                requestBody: { raw },
            });
            sentTo.push(emailTo);
        } catch (e: any) {
            errors.push(`Error kirim ke ${emailTo}: ${String(e)}`);
        }
    }

    if (sentTo.length) {
        return {
            ok: true,
            message: `Email berhasil dikirim ke ${sentTo.length} validator`,
            sentTo,
            errors: errors.length ? errors : undefined,
        };
    }

    throw new AppError("Gagal mengirim email ke semua validator", 500);
}

export async function validateDokumentasi(input: ValidateQueryInput): Promise<{ statusCode: number; html: string }> {
    const ulok = (input.ulok ?? "").trim();
    const status = (input.status ?? "").trim().toUpperCase();
    const catatan = (input.catatan ?? "").trim();
    const validator = (input.validator ?? "Email Validator").trim();

    if (!ulok) {
        return {
            statusCode: 400,
            html: "<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:50px;\"><h1 style=\"color:#e74c3c;\">Error</h1><p>Parameter 'ulok' tidak ditemukan.</p></body></html>",
        };
    }

    if (!["VALID", "REVISI", "DITOLAK"].includes(status)) {
        return {
            statusCode: 400,
            html: `<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:50px;\"><h1 style=\"color:#e74c3c;\">Error</h1><p>Status '${escapeHtml(status)}' tidak valid.</p></body></html>`,
        };
    }

    if (status === "REVISI" && !catatan) {
        return {
            statusCode: 200,
            html: `
<html>
<head>
<title>Form Revisi - ${escapeHtml(ulok)}</title>
<style>
body { font-family: Arial, sans-serif; padding: 50px; max-width: 600px; margin: auto; }
h1 { color: #2c3e50; }
.form-group { margin: 20px 0; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
textarea { width: 100%; height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
button { background-color: #e74c3c; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
</style>
</head>
<body>
<h1>Form Permintaan Revisi</h1>
<p><strong>Nomor Ulok:</strong> ${escapeHtml(ulok)}</p>
<form method="GET" action="/api/dok/validate">
<input type="hidden" name="ulok" value="${escapeHtml(ulok)}" />
<input type="hidden" name="status" value="REVISI" />
<div class="form-group">
<label for="catatan">Catatan Revisi (wajib diisi):</label>
<textarea name="catatan" id="catatan" required placeholder="Jelaskan apa yang perlu direvisi..."></textarea>
</div>
<button type="submit">Kirim Permintaan Revisi</button>
</form>
</body>
</html>`,
        };
    }

    try {
        const rows = await readSheetRows(env.DOC_BANGUNAN_SHEET_FINAL);
        if (!rows.length) throw new Error("Sheet dokumentasi_bangunan kosong");

        const headers = rows[0];
        const ulokIdx = getHeaderIndex(headers, "Nomor Ulok");
        const statusIdx = getHeaderIndex(headers, "Status Validasi");
        const validatorIdx = getHeaderIndex(headers, "Validator");
        const waktuIdx = getHeaderIndex(headers, "Waktu Validasi");
        const catatanIdx = getHeaderIndex(headers, "Catatan Revisi");

        if (ulokIdx < 0 || statusIdx < 0) {
            throw new Error("Kolom 'Nomor Ulok' atau 'Status Validasi' tidak ditemukan");
        }

        let foundRowIdx: number | null = null;
        let foundRow: string[] = [];

        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (String(r[ulokIdx] ?? "").trim() === ulok) {
                foundRowIdx = i + 1;
                foundRow = [...r];
                break;
            }
        }

        if (!foundRowIdx) throw new Error(`Data dengan Nomor Ulok '${ulok}' tidak ditemukan`);

        while (foundRow.length < headers.length) foundRow.push("");

        foundRow[statusIdx] = status;
        if (validatorIdx >= 0) foundRow[validatorIdx] = validator || "Email Validator";
        if (waktuIdx >= 0) foundRow[waktuIdx] = new Date().toISOString();
        if (catatanIdx >= 0 && catatan) foundRow[catatanIdx] = catatan;

        await updateRow(env.DOC_BANGUNAN_SHEET_FINAL, foundRowIdx, foundRow);

        if (status === "VALID") {
            return {
                statusCode: 200,
                html: `<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:50px;\"><h1 style=\"color:#27ae60;\">Validasi Berhasil</h1><p>Nomor Ulok <strong>${escapeHtml(ulok)}</strong> telah divalidasi.</p><p>Status: <span style=\"background:#27ae60;color:white;padding:5px 15px;border-radius:3px;\">VALID</span></p></body></html>`,
            };
        }

        return {
            statusCode: 200,
            html: `<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:50px;\"><h1 style=\"color:#e67e22;\">Permintaan Revisi Dikirim</h1><p>Nomor Ulok <strong>${escapeHtml(ulok)}</strong> memerlukan revisi.</p><p>Status: <span style=\"background:#e67e22;color:white;padding:5px 15px;border-radius:3px;\">${escapeHtml(status)}</span></p><p><strong>Catatan:</strong> ${escapeHtml(catatan || "-")}</p></body></html>`,
        };
    } catch (e: any) {
        return {
            statusCode: 500,
            html: `<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:50px;\"><h1 style=\"color:#e74c3c;\">Error</h1><p>Terjadi kesalahan saat memproses validasi:</p><p style=\"color:#c0392b;\">${escapeHtml(String(e))}</p></body></html>`,
        };
    }
}
