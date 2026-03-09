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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Konfigurasi environment tidak valid:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
