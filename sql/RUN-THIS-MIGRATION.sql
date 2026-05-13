-- ============================================================
-- MASTER MIGRATION — Semua perubahan yang BELUM ada di DB
-- Aman dijalankan berulang kali (idempotent)
-- Jalankan file ini sekali ke database Anda
-- ============================================================

-- ============================================================
-- [1] TABEL projek_planning_foto_item
--     File asal: 2026-05-12-create-projek-planning-foto-item.sql
--     Kolom: id_projek_planning, item_index, link_foto
-- ============================================================
CREATE TABLE IF NOT EXISTS projek_planning_foto_item (
    id SERIAL PRIMARY KEY,
    id_projek_planning INT NOT NULL,
    item_index INT NOT NULL,
    link_foto VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_projek_planning_foto_item
        FOREIGN KEY (id_projek_planning)
        REFERENCES projek_planning(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projek_planning_foto_item_projek
    ON projek_planning_foto_item(id_projek_planning);


-- ============================================================
-- [2] KOLOM BARU di tabel projek_planning
--     File asal: 2026-05-13-add-ruko-kompetitor-projek-planning.sql
--     Kolom: is_ruko, jumlah_lantai, link_gambar_kompetitor
-- ============================================================
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS is_ruko               BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS jumlah_lantai         INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_gambar_kompetitor TEXT    DEFAULT NULL;


-- ============================================================
-- VERIFIKASI — Cek apakah semua kolom sudah ada
-- ============================================================
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'projek_planning'
  AND column_name IN (
      'link_fpd',
      'link_gambar_kerja',
      'link_gambar_rab_sipil',
      'link_gambar_rab_me',
      'link_gambar_kompetitor',
      'is_ruko',
      'jumlah_lantai'
  )
ORDER BY column_name;

SELECT 'projek_planning_foto_item EXISTS: ' || COUNT(*)::text AS status
FROM information_schema.tables
WHERE table_name = 'projek_planning_foto_item';
