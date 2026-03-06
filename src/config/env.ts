import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
    PORT: z.coerce.number().default(8081),
    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
    CORS_ORIGINS: z.string().default("*")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Konfigurasi environment tidak valid:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
