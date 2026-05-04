-- ============================================================
-- Dokumentasi Bangunan
-- ============================================================

CREATE TABLE IF NOT EXISTS dokumentasi_bangunan (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(255),
    nama_toko VARCHAR(255),
    kode_toko VARCHAR(255),
    cabang VARCHAR(255),
    tanggal_go VARCHAR(255),
    tanggal_serah_terima VARCHAR(255),
    tanggal_ambil_foto VARCHAR(255),
    spk_awal VARCHAR(255),
    spk_akhir VARCHAR(255),
    kontraktor_sipil VARCHAR(255),
    kontraktor_me VARCHAR(255),
    link_pdf VARCHAR(500),
    email_pengirim VARCHAR(255),
    status_validasi VARCHAR(255),
    alasan_revisi VARCHAR(255),
    pic_dokumentasi VARCHAR(255),
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_kode_toko ON dokumentasi_bangunan(kode_toko);
CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_nomor_ulok ON dokumentasi_bangunan(nomor_ulok);

CREATE TABLE IF NOT EXISTS dokumentasi_bangunan_item (
    id SERIAL PRIMARY KEY,
    id_dokumentasi_bangunan INT NOT NULL,
    link_foto VARCHAR(500),
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_dokumentasi_bangunan_item
        FOREIGN KEY (id_dokumentasi_bangunan)
        REFERENCES dokumentasi_bangunan(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_item_doc ON dokumentasi_bangunan_item(id_dokumentasi_bangunan);
