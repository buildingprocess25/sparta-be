-- ============================================================
-- Migration: CREATE TABLE berkas_serah_terima
-- Date: 2026-04-27
-- ============================================================

CREATE TABLE IF NOT EXISTS berkas_serah_terima (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    link_pdf VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_berkas_serah_terima_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_berkas_serah_terima_id_toko ON berkas_serah_terima(id_toko);
