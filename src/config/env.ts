import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
    PORT: z.coerce.number().default(8081),
    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
    CORS_ORIGINS: z.string().default("*"),

    // Google credentials – document module
    GOOGLE_TOKEN_PATH: z.string().optional(),
    GOOGLE_DOC_TOKEN_PATH: z.string().optional(),
    SPREADSHEET_ID: z.string().default("1LA1TlhgltT2bqSN3H-LYasq9PtInVlqq98VPru8txoo"),
    DOC_SPREADSHEET_ID: z.string().default("1bEslAY1gGm1QgYl_ZL88_rt5z-errU7HU3GkqbWcNOw"),
    DOC_DRIVE_ROOT_ID: z.string().default("14hjuP33ez1v1WDxkTi7A3k-XfKOZKVTc"),
    DOC_SHEET_NAME: z.string().default("penyimpanan_dokumen"),

    // Google credentials / config - dokumentasi bangunan
    DOC_BANGUNAN_SPREADSHEET_ID: z.string().default("1LA1TlhgltT2bqSN3H-LYasq9PtInVlqq98VPru8txoo"),
    DOC_BANGUNAN_DRIVE_FOLDER_ID: z.string().default("1ZTHC7vvvKOIejATqAYeluxfVDaGax1cd"),
    DOC_BANGUNAN_DEFAULT_PHOTO_ID: z.string().default("14x-tF0TDAZA9t4lbk6GrHXL8RccxxnjQ"),
    DOC_BANGUNAN_SHEET_TEMP: z.string().default("dokumentasi_temp"),
    DOC_BANGUNAN_SHEET_FINAL: z.string().default("dokumentasi_bangunan"),
    CABANG_SHEET_NAME: z.string().default("Cabang"),
    SPK_DATA_SHEET_NAME: z.string().default("SPK_Data"),
    KONTRAKTOR_SHEET_ID: z.string().default("1s95mAc0yXEyDwUDyyOzsDdIqIPEETZkA62_jQQBWXyw"),
    KONTRAKTOR_SHEET_NAME: z.string().default("Monitoring Kontraktor"),

    // PDF RAB storage – same as Python config.PDF_STORAGE_FOLDER_ID
    PDF_STORAGE_FOLDER_ID: z.string().default("1lvPxOwNILXHmagVfPGkVlNEtfv3U4Emj"),

    // Puppeteer / Chrome runtime (useful on Render)
    PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
    PUPPETEER_CACHE_DIR: z.string().optional(),
    PUPPETEER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),

    // Postgres pool
    PG_POOL_MAX: z.coerce.number().int().positive().default(5),
    PG_KEEP_ALIVE: z.coerce.boolean().default(true),
    PG_CONN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    PG_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Konfigurasi environment tidak valid:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
