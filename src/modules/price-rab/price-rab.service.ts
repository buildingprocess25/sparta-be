import type { sheets_v4 } from "googleapis";
import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { BRANCH_TO_ULOK_MAP, SBO_SPREADSHEET_ID, SPREADSHEET_IDS } from "./price-rab.constants";

type PriceValue = number | "Kondisional" | "SBO";

type PriceItem = {
    "Jenis Pekerjaan": string;
    "Satuan": string;
    "Harga Material": PriceValue;
    "Harga Upah": PriceValue;
};

export type PriceResult = Record<string, PriceItem[]>;

function safeToFloat(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "-") return 0;
        const parsed = Number(trimmed.replaceAll(",", ""));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function processPriceValue(rawValue: unknown): PriceValue {
    const valueStr = String(rawValue ?? "").trim().toLowerCase();
    if (valueStr === "kondisional") return "Kondisional";
    if (valueStr === "sbo") return "SBO";
    if (valueStr.includes("kontraktor")) return 0;
    return safeToFloat(rawValue);
}

async function getFirstSheetName(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<string> {
    const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(title))"
    });

    const sheetName = meta.data.sheets?.[0]?.properties?.title;
    if (!sheetName) {
        throw new AppError("Sheet pertama tidak ditemukan", 500);
    }

    return sheetName;
}

function processSheet(allValues: string[][], lingkup: "ME" | "SIPIL"): PriceResult {
    const categorizedPrices: PriceResult = {};
    let currentCategory = "Uncategorized";

    const noColIndex = 1;
    const jenisPekerjaanColIndex = 3;
    const satColIndex = 4;

    const targetHeaderRowIndex = lingkup === "SIPIL" ? 16 : 13;
    if (allValues.length <= targetHeaderRowIndex) {
        throw new AppError(`Baris header tidak ditemukan di sheet untuk lingkup ${lingkup}.`, 500);
    }

    const headerRow = (allValues[targetHeaderRowIndex] ?? []).map((cell) => String(cell).trim());

    let materialColIndex = -1;
    let upahColIndex = -1;
    headerRow.forEach((headerText, i) => {
        const lower = headerText.toLowerCase();
        if (lower.includes("material")) materialColIndex = i;
        if (lower.includes("upah")) upahColIndex = i;
    });

    if (materialColIndex === -1 || upahColIndex === -1) {
        throw new AppError(`Error pada header untuk lingkup ${lingkup}: Header 'Material' atau 'Upah' tidak ditemukan.`, 500);
    }

    for (const row of allValues) {
        if (row.length <= jenisPekerjaanColIndex || !String(row[jenisPekerjaanColIndex] ?? "").trim()) {
            continue;
        }

        const noVal = String(row[noColIndex] ?? "").trim();
        const jenisPekerjaan = String(row[jenisPekerjaanColIndex] ?? "").trim();

        if (!noVal || jenisPekerjaan.toUpperCase() === "JENIS PEKERJAAN") {
            continue;
        }

        if (/^[IVXLCDM]+$/.test(noVal)) {
            currentCategory = jenisPekerjaan;
            if (!categorizedPrices[currentCategory]) categorizedPrices[currentCategory] = [];
            continue;
        }

        const satuanVal = String(row[satColIndex] ?? "").trim();
        if (!satuanVal) continue;

        const hargaMaterialRaw = row[materialColIndex] ?? "0";
        const hargaUpahRaw = row[upahColIndex] ?? "0";

        const itemData: PriceItem = {
            "Jenis Pekerjaan": jenisPekerjaan,
            "Satuan": satuanVal,
            "Harga Material": processPriceValue(hargaMaterialRaw),
            "Harga Upah": processPriceValue(hargaUpahRaw)
        };

        if (!categorizedPrices[currentCategory]) categorizedPrices[currentCategory] = [];
        categorizedPrices[currentCategory].push(itemData);
    }

    return categorizedPrices;
}

function processSboSheet(records: Record<string, string>[], cabangKode: string, lingkup: "ME" | "SIPIL"): PriceResult {
    const sboItems: PriceItem[] = [];

    for (const record of records) {
        if (String(record["Lingkup_Pekerjaan"] ?? "").toUpperCase() !== lingkup) {
            continue;
        }

        const kodeCabangRaw = String(record["Kode Cabang"] ?? "");
        if (!kodeCabangRaw.split(",").map((v) => v.trim()).includes(cabangKode)) {
            continue;
        }

        sboItems.push({
            "Jenis Pekerjaan": String(record["Item Pekerjaan"] ?? ""),
            "Satuan": String(record["Satuan"] ?? ""),
            "Harga Material": processPriceValue(record["Harga Material"]),
            "Harga Upah": 0
        });
    }

    return sboItems.length ? { "PEKERJAAN SBO": sboItems } : {};
}

export const priceRabService = {
    async getData(cabangRaw: string, lingkupRaw: string): Promise<PriceResult> {
        const cabang = cabangRaw.toUpperCase();
        const lingkup = lingkupRaw.toUpperCase() as "ME" | "SIPIL";

        if (!SPREADSHEET_IDS[cabang] || !SPREADSHEET_IDS[cabang][lingkup]) {
            throw new AppError("Invalid 'cabang' or 'lingkup' parameter", 404);
        }

        const spreadsheetId = SPREADSHEET_IDS[cabang][lingkup];

        const gp = GoogleProvider.instance;
        const sheets = gp.spartaSheets;

        if (!sheets) {
            throw new AppError("Google Sheets (Sparta) belum terkonfigurasi", 500);
        }

        const sourceSheetName = await getFirstSheetName(sheets, spreadsheetId);
        const allValues = await gp.getAllValues(sheets, spreadsheetId, sourceSheetName);

        const processedData = processSheet(allValues, lingkup);

        const cabangKode = BRANCH_TO_ULOK_MAP[cabang];
        if (cabangKode) {
            try {
                const sboSheetName = await getFirstSheetName(sheets, SBO_SPREADSHEET_ID);
                const sboRecords = await gp.getAllRecords(sheets, SBO_SPREADSHEET_ID, sboSheetName);
                const sboData = processSboSheet(sboRecords, cabangKode, lingkup);
                Object.assign(processedData, sboData);
            } catch (err) {
                console.warn("Warning: Could not fetch or process SBO data:", err);
            }
        }

        return processedData;
    }
};
