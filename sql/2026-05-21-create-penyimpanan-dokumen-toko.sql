CREATE TABLE IF NOT EXISTS penyimpanan_dokumen_toko (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(100),
    kode_toko VARCHAR(100),
    nama_toko VARCHAR(255),
    cabang VARCHAR(150),
    proyek VARCHAR(150),
    folder_link TEXT,
    source_timestamp TIMESTAMP NULL,
    source_last_edit TIMESTAMP NULL,
    migrated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

ALTER TABLE penyimpanan_dokumen_toko
ADD COLUMN IF NOT EXISTS nomor_ulok VARCHAR(100);

ALTER TABLE penyimpanan_dokumen_toko
ADD COLUMN IF NOT EXISTS proyek VARCHAR(150);

CREATE UNIQUE INDEX IF NOT EXISTS ux_penyimpanan_dokumen_toko_identity
ON penyimpanan_dokumen_toko (
    COALESCE(LOWER(kode_toko), ''),
    COALESCE(LOWER(nama_toko), ''),
    COALESCE(LOWER(cabang), '')
);

CREATE INDEX IF NOT EXISTS idx_penyimpanan_dokumen_toko_search
ON penyimpanan_dokumen_toko (kode_toko, nama_toko, cabang);
