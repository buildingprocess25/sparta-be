import { env } from "../../config/env";
import { AppError } from "../../common/app-error";
import { GoogleProvider, logDoc, withGoogleRetry } from "../../common/google";
import { ALLOWED_ROLES, guessMime, decodeBase64MaybeWithPrefix } from "./document.constants";
import type { LoginDocInput, SaveDocumentInput, UpdateDocumentInput } from "./document.schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jakartaNow(): string {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date());
}

function getProvider(): GoogleProvider {
    return GoogleProvider.instance;
}

// ---------------------------------------------------------------------------
// LOGIN – sama persis dg login_doc() di Python
// ---------------------------------------------------------------------------
export async function loginDoc(input: LoginDocInput) {
    const username = (input.username ?? "").trim().toLowerCase();
    const password = (input.password ?? "").trim().toUpperCase();

    logDoc("login_doc", "request received", { username });

    if (!username || !password) {
        logDoc("login_doc", "missing credentials", { has_username: !!username, has_password: !!password });
        throw new AppError("Username dan password wajib diisi", 400);
    }

    const provider = getProvider();
    if (!provider.spartaSheets) throw new AppError("Service Sparta belum siap", 500);

    const records = await withGoogleRetry(
        () => provider.getAllRecords(provider.spartaSheets!, env.SPREADSHEET_ID, "Cabang"),
        "login_get_all_records",
    );

    for (const row of records) {
        const email = String(row["EMAIL_SAT"] ?? "").trim().toLowerCase();
        const jabatan = String(row["JABATAN"] ?? "").trim().toUpperCase();
        const cabang = String(row["CABANG"] ?? "").trim().toUpperCase();
        const nama = String(row["NAMA LENGKAP"] ?? "").trim();

        if (email === username && password === cabang) {
            if (ALLOWED_ROLES.includes(jabatan)) {
                logDoc("login_doc", "authenticated", { email, cabang, jabatan });
                return {
                    ok: true,
                    user: { email, nama, jabatan, cabang },
                };
            } else {
                logDoc("login_doc", "forbidden role", { email, cabang, jabatan });
                throw new AppError("Jabatan tidak diizinkan", 403);
            }
        }
    }

    logDoc("login_doc", "invalid credentials", { username });
    throw new AppError("Username atau password salah", 401);
}

// ---------------------------------------------------------------------------
// LIST – sama persis dg list_documents() di Python
// ---------------------------------------------------------------------------
export async function listDocuments(cabang?: string) {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);

    const data = await withGoogleRetry(
        () => provider.getAllRecords(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME),
        "list_get_all_records",
    );

    logDoc("list_documents", "fetched records", { total: data.length, cabang_filter: cabang || "-" });

    // Normalisasi kolom ke lowercase
    const normalized = data.map((row) => {
        const newRow: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
            newRow[k.toLowerCase()] = v;
        }
        return newRow;
    });

    let filtered = normalized;
    if (cabang) {
        const cabangLower = cabang.trim().toLowerCase();
        filtered = normalized.filter((r) => (r["cabang"] ?? "").trim().toLowerCase() === cabangLower);
    }

    logDoc("list_documents", "returning items", { count: filtered.length });
    return { ok: true, items: filtered };
}

// ---------------------------------------------------------------------------
// SAVE – sama persis dg save_document_base64() di Python
// ---------------------------------------------------------------------------
export async function saveDocument(input: SaveDocumentInput) {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);

    const {
        kode_toko, nama_toko, cabang,
        luas_sales, luas_parkir, luas_gudang,
        luas_bangunan_lantai_1, luas_bangunan_lantai_2, luas_bangunan_lantai_3,
        total_luas_bangunan, luas_area_terbuka, tinggi_plafon,
        files, email,
    } = input;

    logDoc("save_document_base64", "request received", {
        kode_toko, nama_toko, cabang, files: files.length, email,
    });

    if (!kode_toko || !nama_toko || !cabang) {
        logDoc("save_document_base64", "missing required fields");
        throw new AppError("Data toko belum lengkap.", 400);
    }

    // 1. Buka Sheet – validasi duplikat
    const existingRecords = await withGoogleRetry(
        () => provider.getAllRecords(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME),
        "save_get_all_records",
    );
    logDoc("save_document_base64", "existing records fetched", { count: existingRecords.length });

    for (const row of existingRecords) {
        const existingCode = String(row["kode_toko"] ?? row["KodeToko"] ?? "").trim().toUpperCase();
        if (existingCode === kode_toko.trim().toUpperCase()) {
            logDoc("save_document_base64", "duplicate kode_toko", { kode_toko });
            throw new AppError(`Kode toko '${kode_toko}' sudah terdaftar.`, 400);
        }
    }

    // 2. Upload ke Drive
    const cabangFolder = await withGoogleRetry(
        () => provider.getOrCreateFolder(cabang, env.DOC_DRIVE_ROOT_ID),
        "save_create_cabang_folder",
    );
    const tokoFolderName = `${kode_toko}_${nama_toko}`.replace(/\//g, "-");
    const tokoFolder = await withGoogleRetry(
        () => provider.getOrCreateFolder(tokoFolderName, cabangFolder),
        "save_create_toko_folder",
    );

    logDoc("save_document_base64", "folders prepared", { cabang_folder: cabangFolder, toko_folder: tokoFolder });

    const categoryFolders: Record<string, string> = {};
    const fileLinks: string[] = [];

    for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        const category = (f.category ?? "lainnya").trim() || "lainnya";
        if (!categoryFolders[category]) {
            categoryFolders[category] = await withGoogleRetry(
                () => provider.getOrCreateFolder(category, tokoFolder),
                "save_create_category_folder",
            );
        }

        const filename = f.filename || `file_${idx + 1}`;
        const mimeType = guessMime(filename, f.type);

        try {
            const raw = decodeBase64MaybeWithPrefix(f.data || "");
            const uploaded = await provider.uploadFile(
                categoryFolders[category],
                filename,
                mimeType,
                raw,
            );

            const link = uploaded.webViewLink;
            const thumb = uploaded.thumbnailLink;
            let directLink = "";
            if (link) {
                const fid = link.split("/d/")[1]?.split("/")[0] ?? "";
                directLink = `https://drive.google.com/uc?export=view&id=${fid}`;
            } else if (thumb) {
                directLink = thumb;
            }

            if (directLink) {
                fileLinks.push(`${category}|${filename}|${directLink}`);
            }
        } catch (e: any) {
            logDoc("save_document_base64", "upload failed", { filename, category, error: String(e) });
        }
    }

    // 3. Simpan ke Sheet
    const now = jakartaNow();
    await withGoogleRetry(
        () => provider.appendRow(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME, [
            kode_toko, nama_toko, cabang,
            luas_sales, luas_parkir, luas_gudang,
            luas_bangunan_lantai_1, luas_bangunan_lantai_2, luas_bangunan_lantai_3,
            total_luas_bangunan, luas_area_terbuka, tinggi_plafon,
            `https://drive.google.com/drive/folders/${tokoFolder}`,
            fileLinks.join(", "),
            now,
            email,
        ]),
        "save_append_row",
    );

    logDoc("save_document_base64", "saved", {
        uploaded: fileLinks.length,
        folder_link: `https://drive.google.com/drive/folders/${tokoFolder}`,
        last_edit: email,
    });

    return {
        ok: true,
        message: `${fileLinks.length} file berhasil diunggah`,
        folder_link: `https://drive.google.com/drive/folders/${tokoFolder}`,
        last_edit: email,
    };
}

// ---------------------------------------------------------------------------
// UPDATE – sama persis dg update_document() di Python
// ---------------------------------------------------------------------------
export async function updateDocument(kodeToko: string, input: UpdateDocumentInput) {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);

    const files = input.files;
    const email = input.email;

    logDoc("update_document", "request received", { kode_toko: kodeToko, files: files.length, email });

    const updateTimestamp = jakartaNow();

    // Buka Sheet
    const records = await withGoogleRetry(
        () => provider.getAllRecords(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME),
        "update_get_all_records",
    );
    logDoc("update_document", "records fetched", { total: records.length });

    // Cari baris (row_index 1-based; +2 karena header di baris 1)
    let rowIndex: number | null = null;
    for (let i = 0; i < records.length; i++) {
        if (String(records[i]["kode_toko"] ?? "").trim() === String(kodeToko).trim()) {
            rowIndex = i + 2;
            break;
        }
    }

    if (!rowIndex) {
        logDoc("update_document", "row not found", { kode_toko: kodeToko });
        throw new AppError("Data tidak ditemukan", 404);
    }

    const oldData = records[rowIndex - 2];
    const oldFolderLink = oldData["folder_link"] ?? "";
    if (!oldFolderLink || !oldFolderLink.includes("folders/")) {
        logDoc("update_document", "invalid drive folder", { folder_link: oldFolderLink });
        throw new AppError("Folder Drive toko tidak valid", 400);
    }

    const tokoFolderId = oldFolderLink.split("folders/").pop()!;

    // Ambil file lama dari links
    const oldFileLinksStr = oldData["file_links"] ?? "";
    const oldFilesList: { category: string; filename: string; link: string }[] = [];
    if (oldFileLinksStr) {
        for (const entry of oldFileLinksStr.split(",")) {
            const parts = entry.split("|").map((p: string) => p.trim());
            if (parts.length >= 3) {
                oldFilesList.push({ category: parts[0], filename: parts[1], link: parts[2] });
            }
        }
    }

    // Ambil daftar folder kategori yang ada di Drive
    const categoryFoldersMap: Record<string, string> = {};
    const existingFilesDrive: { id: string; name: string; category: string }[] = [];
    try {
        const subfolders = await provider.listSubFolders(tokoFolderId);
        for (const sf of subfolders) {
            categoryFoldersMap[sf.name] = sf.id;
        }
        for (const [catName, folderId] of Object.entries(categoryFoldersMap)) {
            const catFiles = await provider.listFolderFiles(folderId);
            for (const f of catFiles) {
                existingFilesDrive.push({ id: f.id, name: f.name, category: catName });
            }
        }
    } catch (e: any) {
        logDoc("update_document", "error reading drive folders", { error: String(e) });
    }

    // Pisahkan file berdasarkan tipe (sama persis dg Python)
    const filesToDelete: { category: string; filename: string }[] = [];
    const filesToUpload: typeof files = [];
    const filesToKeepKeys = new Set<string>();

    for (const f of files) {
        const category = (f.category ?? "pendukung").trim();
        const filename = f.filename ?? "";

        if (f.deleted === true) {
            filesToDelete.push({ category, filename });
        } else if (f.data) {
            filesToUpload.push(f);
            filesToKeepKeys.add(`${category}|${filename}`);
        } else {
            filesToKeepKeys.add(`${category}|${filename}`);
        }
    }

    logDoc("update_document", "files classified", {
        to_delete: filesToDelete.length,
        to_upload: filesToUpload.length,
        to_keep: filesToKeepKeys.size,
    });

    // Eksekusi hapus file yang ditandai deleted=true
    for (const delFile of filesToDelete) {
        const driveFile = existingFilesDrive.find(
            (f) => f.category === delFile.category && f.name === delFile.filename,
        );
        if (driveFile) {
            try {
                await provider.deleteDriveFile(driveFile.id);
                logDoc("update_document", "deleted from drive", { filename: driveFile.name, category: driveFile.category });
            } catch (delErr: any) {
                logDoc("update_document", "delete failed", { filename: driveFile.name, category: driveFile.category, error: String(delErr) });
            }
        }
    }

    // Logic Upload Baru & Pertahankan File Lama
    const newFileLinks: string[] = [];
    const categoryCache: Record<string, string> = {};

    // 1. Pertahankan semua file lama yang TIDAK dihapus
    const deletedKeys = new Set(filesToDelete.map((f) => `${f.category}|${f.filename}`));
    const newUploadFilenames = new Set(filesToUpload.map((f) => `${(f.category ?? "pendukung").trim()}|${f.filename}`));
    for (const oldFile of oldFilesList) {
        const key = `${oldFile.category}|${oldFile.filename}`;
        if (!deletedKeys.has(key) && !newUploadFilenames.has(key)) {
            newFileLinks.push(`${oldFile.category}|${oldFile.filename}|${oldFile.link}`);
        }
    }

    // 2. Upload file baru
    for (const f of filesToUpload) {
        const category = (f.category ?? "pendukung").trim();
        const filename = f.filename ?? "";

        if (!categoryCache[category]) {
            categoryCache[category] = await provider.getOrCreateFolder(category, tokoFolderId);
        }

        // Hapus file lama dengan nama sama jika ada (replace)
        const oldDriveFile = existingFilesDrive.find(
            (df) => df.category === category && df.name === filename,
        );
        if (oldDriveFile) {
            try {
                await provider.deleteDriveFile(oldDriveFile.id);
                logDoc("update_document", "replace existing file", { filename, category });
            } catch (e: any) {
                logDoc("update_document", "replace delete failed", { filename, category, error: String(e) });
            }
        }

        const raw = decodeBase64MaybeWithPrefix(f.data!);
        const mime = guessMime(filename, f.type);

        const uploaded = await provider.uploadFile(categoryCache[category], filename, mime, raw);

        const link = uploaded.webViewLink;
        let fid = "";
        if (link) {
            fid = link.split("/d/")[1]?.split("/")[0] ?? "";
        }
        const direct = fid ? `https://drive.google.com/uc?export=view&id=${fid}` : "";

        newFileLinks.push(`${category}|${filename}|${direct}`);
    }

    logDoc("update_document", "upload completed", {
        uploaded: filesToUpload.length,
        kept: newFileLinks.length - filesToUpload.length,
    });

    // Update Sheet (urutan kolom sama persis dg Python)
    const cellRange = `A${rowIndex}:P${rowIndex}`;
    await withGoogleRetry(
        () => provider.updateRow(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME, cellRange, [
            oldData["kode_toko"],
            oldData["nama_toko"],
            oldData["cabang"],
            input.luas_sales ?? oldData["luas_sales"],
            input.luas_parkir ?? oldData["luas_parkir"],
            input.luas_gudang ?? oldData["luas_gudang"],
            input.luas_bangunan_lantai_1 ?? oldData["luas_bangunan_lantai_1"],
            input.luas_bangunan_lantai_2 ?? oldData["luas_bangunan_lantai_2"],
            input.luas_bangunan_lantai_3 ?? oldData["luas_bangunan_lantai_3"],
            input.total_luas_bangunan ?? oldData["total_luas_bangunan"],
            input.luas_area_terbuka ?? oldData["luas_area_terbuka"],
            input.tinggi_plafon ?? oldData["tinggi_plafon"],
            oldFolderLink,
            newFileLinks.join(", "),
            updateTimestamp,
            email,
        ]),
        "update_sheet_row",
    );

    logDoc("update_document", "sheet updated", {
        kode_toko: kodeToko,
        row: rowIndex,
        updated_at: updateTimestamp,
        last_edit: email,
    });

    return { ok: true, message: "Berhasil update", last_edit: email, updated_at: updateTimestamp };
}

// ---------------------------------------------------------------------------
// DELETE – sama persis dg delete_document() di Python
// ---------------------------------------------------------------------------
export async function deleteDocument(kodeToko: string) {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);

    const records = await withGoogleRetry(
        () => provider.getAllRecords(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME),
        "delete_get_all_records",
    );

    logDoc("delete_document", "request received", { kode_toko: kodeToko, total_records: records.length });

    let rowIndex: number | null = null;
    for (let i = 0; i < records.length; i++) {
        if (String(records[i]["kode_toko"] ?? "").trim() === String(kodeToko).trim()) {
            rowIndex = i + 2;
            break;
        }
    }

    if (!rowIndex) {
        logDoc("delete_document", "row not found", { kode_toko: kodeToko });
        throw new AppError("Data tidak ditemukan", 404);
    }

    // Hapus folder di Drive
    const folderLink = records[rowIndex - 2]["folder_link"] ?? "";
    if (folderLink && folderLink.includes("folders/")) {
        const folderId = folderLink.split("folders/").pop()!;
        await provider.deleteDriveFile(folderId);
        logDoc("delete_document", "drive folder deleted", { folder_id: folderId });
    }

    await withGoogleRetry(
        () => provider.deleteRow(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME, rowIndex!),
        "delete_row",
    );
    logDoc("delete_document", "row deleted", { row: rowIndex });

    return { ok: true, message: "Dokumen dihapus" };
}

// ---------------------------------------------------------------------------
// DETAIL – sama persis dg get_document_detail() di Python
// ---------------------------------------------------------------------------
export async function getDocumentDetail(kodeToko: string) {
    const provider = getProvider();
    if (!provider.docSheets) throw new AppError("Service Dokumen belum siap", 500);

    const records = await withGoogleRetry(
        () => provider.getAllRecords(provider.docSheets!, env.DOC_SPREADSHEET_ID, env.DOC_SHEET_NAME),
        "detail_get_all_records",
    );

    logDoc("get_document_detail", "records fetched", { total: records.length, kode_toko: kodeToko });

    const found = records.find(
        (r) => String(r["kode_toko"] ?? "").trim() === String(kodeToko).trim(),
    );

    if (!found) {
        logDoc("get_document_detail", "not found", { kode_toko: kodeToko });
        throw new AppError("Data tidak ditemukan", 404);
    }

    logDoc("get_document_detail", "found", { kode_toko: kodeToko });
    return { ok: true, data: found };
}
