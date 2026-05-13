-- ============================================================
-- Migration: 2026-05-13-add-ruko-kompetitor-projek-planning.sql
-- Description: Menambahkan kolom is_ruko, jumlah_lantai, dan
--              link_gambar_kompetitor ke tabel projek_planning.
-- ============================================================

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS is_ruko          BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS jumlah_lantai    INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_gambar_kompetitor TEXT DEFAULT NULL;
