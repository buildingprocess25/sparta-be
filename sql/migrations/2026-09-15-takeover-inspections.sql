CREATE TABLE takeover_inspections (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(255) NOT NULL,
    tanggal_takeover DATE NOT NULL,
    diinspeksi_oleh VARCHAR(255),
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now())
);
