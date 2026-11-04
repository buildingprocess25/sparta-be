-- sparta-be/sql/2026-09-29-create-serah-terima-gabungan.sql

CREATE TABLE IF NOT EXISTS serah_terima_gabungan (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(100) NOT NULL,
    id_toko_sipil INTEGER NOT NULL REFERENCES toko(id),
    id_toko_me INTEGER NOT NULL REFERENCES toko(id),
    nama_toko VARCHAR(255),
    cabang VARCHAR(100),
    tanggal_serah_terima DATE NOT NULL,
    pic_pengawasan VARCHAR(255),
    link_pdf VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS serah_terima_gabungan_item (
    id SERIAL PRIMARY KEY,
    id_serah_terima_gabungan INTEGER NOT NULL REFERENCES serah_terima_gabungan(id) ON DELETE CASCADE,
    kategori VARCHAR(50),
    nama_kategori VARCHAR(255),
    id_item VARCHAR(50),
    nama_item VARCHAR(255),
    is_available BOOLEAN DEFAULT false,
    link_foto VARCHAR(500),
    no_urut INTEGER
);
