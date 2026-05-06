-- ============================================================
-- Create table penyimpanan_dokumen
-- ============================================================

CREATE TABLE IF NOT EXISTS penyimpanan_dokumen (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    nama_dokumen VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255),
    drive_folder_id VARCHAR(255),
    link_dokumen VARCHAR(500),
    link_folder VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_penyimpanan_dokumen_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

ALTER TABLE penyimpanan_dokumen
    ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS link_folder VARCHAR(500),
    ALTER COLUMN link_dokumen TYPE VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_penyimpanan_dokumen_id_toko ON penyimpanan_dokumen(id_toko);
CREATE INDEX IF NOT EXISTS idx_penyimpanan_dokumen_nama ON penyimpanan_dokumen(nama_dokumen);
CREATE INDEX IF NOT EXISTS idx_penyimpanan_dokumen_toko_nama ON penyimpanan_dokumen(id_toko, nama_dokumen);
