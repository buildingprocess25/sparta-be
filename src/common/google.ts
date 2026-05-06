import { google, type sheets_v4, type drive_v3, type gmail_v1 } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TokenFileData {
    token?: string;
    refresh_token: string;
    token_uri?: string;
    client_id: string;
    client_secret: string;
    scopes?: string[];
}

// ---------------------------------------------------------------------------
// Helpers – resolve token path (sama persis dg Python: /etc/secrets → lokal)
// ---------------------------------------------------------------------------
function resolveTokenPath(envPath: string | undefined, defaultFilename: string): string | null {
    if (envPath && fs.existsSync(envPath)) return envPath;
    const secretsPath = path.join("/etc/secrets", defaultFilename);
    if (fs.existsSync(secretsPath)) return secretsPath;
    if (fs.existsSync(defaultFilename)) return defaultFilename;
    // cek relatif terhadap server/ (sibling folder)
    const serverPath = path.resolve(__dirname, "../../../server", defaultFilename);
    if (fs.existsSync(serverPath)) return serverPath;
    return null;
}

async function loadOAuth2Client(tokenPath: string) {
    const raw = fs.readFileSync(tokenPath, "utf-8");
    const data: TokenFileData = JSON.parse(raw);
    const client = new google.auth.OAuth2(data.client_id, data.client_secret);
    // Hanya set refresh_token — jangan set access_token lama yang sudah expired.
    // Library akan auto-refresh pakai refresh_token saat pertama kali request.
    client.setCredentials({ refresh_token: data.refresh_token });
    // Force refresh sekarang (sama seperti Python: creds.refresh(Request()))
    try {
        const { credentials } = await client.refreshAccessToken();
        client.setCredentials(credentials);
        console.log(`✅ Token refreshed dari ${path.basename(tokenPath)}`);
    } catch (e) {
        console.error(`⚠️ Gagal refresh token dari ${path.basename(tokenPath)}:`, e);
        // tetap return client — mungkin masih bisa auto-refresh nanti
    }
    return client;
}

// ---------------------------------------------------------------------------
// Logging helper – sama persis dg log_doc di Python
// ---------------------------------------------------------------------------
function formatJakartaTimestamp(): string {
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

export function logDoc(func: string, message: string, extra?: Record<string, unknown>): void {
    const ts = formatJakartaTimestamp();
    const suffix = extra
        ? " | " + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" | ")
        : "";
    console.log(`[DOC][${func}] ${ts} - ${message}${suffix}`);
}

// ---------------------------------------------------------------------------
// Retry helper – sama persis dg with_google_retry di Python
// ---------------------------------------------------------------------------
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGoogleRetry<T>(
    operation: () => Promise<T>,
    opName = "google_call",
    maxRetries = 4,
    baseDelay = 1000,
): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            const status = err?.code ?? err?.response?.status ?? err?.status;
            if (status === 429 && attempt < maxRetries) {
                const delay = baseDelay * 2 ** attempt;
                logDoc("google_retry", "quota hit, retrying", { operation: opName, attempt: attempt + 1, sleep_ms: delay });
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
    throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Google Provider Singleton
// ---------------------------------------------------------------------------
export class GoogleProvider {
    // Sparta (untuk login – baca sheet Cabang)
    spartaSheets: sheets_v4.Sheets | null = null;
    spartaDrive: drive_v3.Drive | null = null;
    spartaGmail: gmail_v1.Gmail | null = null;
    // Doc (untuk document CRUD – sheet + drive)
    docSheets: sheets_v4.Sheets | null = null;
    docDrive: drive_v3.Drive | null = null;

    private static _instance: GoogleProvider | null = null;
    private static _initPromise: Promise<void> | null = null;

    static get instance(): GoogleProvider {
        if (!this._instance) {
            this._instance = new GoogleProvider();
        }
        return this._instance;
    }

    /** Panggil sekali saat startup untuk refresh token. Idempotent. */
    static async initialize(): Promise<GoogleProvider> {
        const inst = this.instance;
        if (!this._initPromise) {
            this._initPromise = inst._loadAll();
        }
        await this._initPromise;
        return inst;
    }

    private constructor() {
        // field sudah di-set null di atas, inisialisasi aslinya di _loadAll()
    }

    private async _loadAll() {
        // --- 1. Sparta credentials (token.json) ---
        const spartaTokenPath = resolveTokenPath(env.GOOGLE_TOKEN_PATH, "token.json");
        if (spartaTokenPath) {
            try {
                const spartaAuth = await loadOAuth2Client(spartaTokenPath);
                this.spartaSheets = google.sheets({ version: "v4", auth: spartaAuth });
                this.spartaDrive = google.drive({ version: "v3", auth: spartaAuth });
                this.spartaGmail = google.gmail({ version: "v1", auth: spartaAuth });
                console.log("✅ Service Sparta (Sheets) Berhasil.");
            } catch (e) {
                console.error("⚠️ Warning: Token Sparta gagal dimuat:", e);
            }
        } else {
            console.warn("⚠️ Warning: token.json tidak ditemukan, login doc tidak tersedia.");
        }

        // --- 2. Doc credentials (token_doc.json) ---
        const docTokenPath = resolveTokenPath(env.GOOGLE_DOC_TOKEN_PATH, "token_doc.json");
        if (docTokenPath) {
            try {
                const docAuth = await loadOAuth2Client(docTokenPath);
                this.docSheets = google.sheets({ version: "v4", auth: docAuth });
                this.docDrive = google.drive({ version: "v3", auth: docAuth });
                console.log("✅ Service Dokumen (Sheets + Drive) Berhasil.");
            } catch (e) {
                console.error("⚠️ Warning: Token Dokumen gagal dimuat:", e);
            }
        } else {
            console.warn("⚠️ Warning: token_doc.json tidak ditemukan, document CRUD tidak tersedia.");
        }
    }

    // ---------------------------------------------------------------------------
    // Sheets Helpers
    // ---------------------------------------------------------------------------

    /** Sama dg gspread get_all_records() – baris 1 = header, sisa = data */
    async getAllRecords(
        sheets: sheets_v4.Sheets,
        spreadsheetId: string,
        sheetName: string,
    ): Promise<Record<string, string>[]> {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
        const rows = res.data.values || [];
        if (rows.length < 2) return [];
        const headers = rows[0] as string[];
        return rows.slice(1).map((row: string[]) => {
            const record: Record<string, string> = {};
            headers.forEach((h, i) => {
                record[h] = (row[i] as string) ?? "";
            });
            return record;
        });
    }

    /** Ambil raw rows (termasuk header + data), berguna saat header duplikat */
    async getAllValues(
        sheets: sheets_v4.Sheets,
        spreadsheetId: string,
        sheetName: string,
    ): Promise<string[][]> {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
        const rows = (res.data.values || []) as string[][];
        return rows;
    }

    /** Sama dg gspread append_row() */
    async appendRow(
        sheets: sheets_v4.Sheets,
        spreadsheetId: string,
        sheetName: string,
        values: unknown[],
    ): Promise<void> {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: sheetName,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [values] },
        });
    }

    /** Sama dg gspread ws.update(range, [[...]]) */
    async updateRow(
        sheets: sheets_v4.Sheets,
        spreadsheetId: string,
        sheetName: string,
        range: string,
        values: unknown[],
    ): Promise<void> {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!${range}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [values] },
        });
    }

    /** Sama dg gspread ws.delete_rows(row_index) – row_index 1-based */
    async deleteRow(
        sheets: sheets_v4.Sheets,
        spreadsheetId: string,
        sheetName: string,
        rowIndex: number,
    ): Promise<void> {
        // Dapatkan sheetId (numeric tab id)
        const meta = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: "sheets.properties.sheetId,sheets.properties.title",
        });
        const sheetInfo = meta.data.sheets?.find((s: any) => s.properties?.title === sheetName);
        const sheetId = sheetInfo?.properties?.sheetId ?? 0;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex,
                            },
                        },
                    },
                ],
            },
        });
    }

    // ---------------------------------------------------------------------------
    // Drive Helpers – semua pakai doc_drive (sama dg Python pakai doc_drive_service)
    // ---------------------------------------------------------------------------

    private ensureDocDrive(): drive_v3.Drive {
        if (!this.docDrive) throw new Error("Service Dokumen belum siap (Token gagal load)");
        return this.docDrive;
    }

    /** Sama dg Python get_or_create_folder() */
    async getOrCreateFolder(name: string, parentId: string): Promise<string> {
        const drive = this.ensureDocDrive();
        const safeName = name.replace(/'/g, "\\'");
        const query = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const res = await drive.files.list({ q: query, fields: "files(id)" });
        const items = res.data.files || [];
        if (items.length > 0) return items[0].id!;

        const folder = await drive.files.create({
            requestBody: {
                name,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentId],
            },
            fields: "id",
        });
        return folder.data.id!;
    }

    private async setPublicPermission(drive: drive_v3.Drive, fileId: string | undefined) {
        if (!fileId) return;
        try {
            await drive.permissions.create({
                fileId,
                requestBody: { type: "anyone", role: "reader" },
                fields: "id",
            });
        } catch (_) {
            // ignore
        }
    }

    /** Sama dg Python upload_file_simple() – driveOverride opsional utk pakai drive lain (misal spartaDrive) */
    async uploadFile(
        folderId: string,
        filename: string,
        mimeType: string,
        buffer: Buffer,
        maxRetry = 2,
        driveOverride?: drive_v3.Drive,
    ): Promise<{ id?: string; webViewLink?: string; thumbnailLink?: string; name?: string; mimeType?: string }> {
        const drive = driveOverride ?? this.ensureDocDrive();

        for (let attempt = 0; attempt <= maxRetry; attempt++) {
            try {
                const uploaded = await drive.files.create({
                    requestBody: { name: filename, parents: [folderId] },
                    media: { mimeType, body: Readable.from(buffer) },
                    fields: "id, webViewLink, thumbnailLink, name, mimeType",
                });

                await this.setPublicPermission(drive, uploaded.data.id ?? undefined);

                await sleep(250);
                return {
                    id: uploaded.data.id ?? undefined,
                    webViewLink: uploaded.data.webViewLink ?? undefined,
                    thumbnailLink: uploaded.data.thumbnailLink ?? undefined,
                    name: uploaded.data.name ?? undefined,
                    mimeType: uploaded.data.mimeType ?? undefined,
                };
            } catch (err: any) {
                const status = err?.code ?? err?.response?.status;
                if ([429, 500, 502, 503, 504].includes(status) && attempt < maxRetry) {
                    await sleep(800 * (attempt + 1));
                    continue;
                }
                throw err;
            }
        }
        throw new Error("upload_file_simple: max retries exceeded");
    }

    /** Resumable upload untuk file besar */
    async uploadFileResumable(
        folderId: string,
        filename: string,
        mimeType: string,
        buffer: Buffer,
        maxRetry = 2,
        driveOverride?: drive_v3.Drive,
    ): Promise<{ id?: string; webViewLink?: string; thumbnailLink?: string; name?: string; mimeType?: string }> {
        const drive = driveOverride ?? this.ensureDocDrive();

        for (let attempt = 0; attempt <= maxRetry; attempt++) {
            try {
                const uploaded = await drive.files.create({
                    requestBody: { name: filename, parents: [folderId] },
                    media: { mimeType, body: Readable.from(buffer) },
                    fields: "id, webViewLink, thumbnailLink, name, mimeType",
                    uploadType: "resumable",
                });

                await this.setPublicPermission(drive, uploaded.data.id ?? undefined);

                await sleep(250);
                return {
                    id: uploaded.data.id ?? undefined,
                    webViewLink: uploaded.data.webViewLink ?? undefined,
                    thumbnailLink: uploaded.data.thumbnailLink ?? undefined,
                    name: uploaded.data.name ?? undefined,
                    mimeType: uploaded.data.mimeType ?? undefined,
                };
            } catch (err: any) {
                const status = err?.code ?? err?.response?.status;
                if ([429, 500, 502, 503, 504].includes(status) && attempt < maxRetry) {
                    await sleep(1200 * (attempt + 1));
                    continue;
                }
                throw err;
            }
        }
        throw new Error("upload_file_resumable: max retries exceeded");
    }

    /** Sama dg Python delete_drive_file() */
    async deleteDriveFile(fileId: string): Promise<void> {
        const drive = this.ensureDocDrive();
        try {
            await drive.files.delete({ fileId });
        } catch (e) {
            console.error(`Gagal hapus file ${fileId}:`, e);
        }
    }

    /** Sama dg Python list files in folder */
    async listFolderFiles(folderId: string): Promise<{ id: string; name: string }[]> {
        const drive = this.ensureDocDrive();
        const query = `'${folderId}' in parents and trashed = false`;
        const res = await drive.files.list({ q: query, fields: "files(id, name)" });
        return (res.data.files || []).map((f: any) => ({ id: f.id!, name: f.name! }));
    }

    /** List sub-folders */
    async listSubFolders(parentId: string): Promise<{ id: string; name: string }[]> {
        const drive = this.ensureDocDrive();
        const query = `'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`;
        const res = await drive.files.list({ q: query, fields: "files(id, name)" });
        return (res.data.files || []).map((f: any) => ({ id: f.id!, name: f.name! }));
    }

    /** Cari file berdasarkan nama di folder tertentu */
    async listFilesByNameInFolder(folderId: string, filename: string): Promise<{ id: string }[]> {
        const drive = this.ensureDocDrive();
        const safeName = filename.replace(/'/g, "\\'");
        const query = `name='${safeName}' and '${folderId}' in parents and trashed=false`;
        const res = await drive.files.list({ q: query, fields: "files(id)" });
        return (res.data.files || []).map((f: any) => ({ id: f.id! }));
    }

    /** Stream file via Drive API; return null jika gagal */
    async getFileBufferById(drive: drive_v3.Drive, fileId: string): Promise<Buffer | null> {
        try {
            const resp = await drive.files.get(
                { fileId, alt: "media" },
                { responseType: "arraybuffer" },
            );
            return Buffer.from(resp.data as ArrayBuffer);
        } catch {
            return null;
        }
    }

    /** Sama persis dg Python get_kontraktor_by_cabang(). */
    async getKontraktorByCabang(userWilayah: string): Promise<string[]> {
        if (!this.spartaSheets) {
            throw new Error("Service Sparta belum siap");
        }

        const allValues = await this.getAllValues(
            this.spartaSheets,
            env.KONTRAKTOR_SHEET_ID,
            env.KONTRAKTOR_SHEET_NAME,
        );

        if (allValues.length < 2) {
            return [];
        }

        const headers = allValues[1] ?? [];
        const records = allValues.slice(2).map((row) => {
            const record: Record<string, string> = {};
            headers.forEach((header, index) => {
                record[String(header ?? "")] = String(row[index] ?? "");
            });
            return record;
        });

        const allowedBranchesLower = userWilayah.trim().toLowerCase();
        const kontraktorList: string[] = [];

        for (const record of records) {
            const wilayah = String(record["WILAYAH"] ?? "").trim().toLowerCase();
            const statusKontraktor = String(record["STATUS KONTRAKTOR"] ?? "").trim().toUpperCase();

            if (wilayah === allowedBranchesLower && statusKontraktor === "AKTIF") {
                const namaKontraktor = String(record["NAMA KONTRAKTOR"] ?? "").trim();
                if (namaKontraktor && !kontraktorList.includes(namaKontraktor)) {
                    kontraktorList.push(namaKontraktor);
                }
            }
        }

        return kontraktorList.sort();
    }
}
