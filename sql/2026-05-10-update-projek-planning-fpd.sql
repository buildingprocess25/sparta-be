-- ============================================================
-- MIGRATION: Update Project Planning — Add FPD Form Fields
-- Date: 2026-05-10
-- Description: Menambahkan kolom-kolom FPD (Form Pengajuan Data) untuk
--              menyimpan data formulir pengajuan design dari Google Form
--              ke dalam tabel projek_planning.
-- ============================================================

-- ── Identitas Pengajuan ──────────────────────────────────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS nama_pengaju VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nama_lokasi VARCHAR(255);

-- ── Jenis Pengajuan Design ───────────────────────────────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS jenis_pengajuan VARCHAR(100),
    ADD COLUMN IF NOT EXISTS jenis_pengajuan_lainnya VARCHAR(255);

-- ── Fasilitas Yang Disediakan ────────────────────────────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS fasilitas_air_bersih BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fasilitas_air_bersih_keterangan TEXT,
    ADD COLUMN IF NOT EXISTS fasilitas_drain BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fasilitas_drain_keterangan TEXT,
    ADD COLUMN IF NOT EXISTS fasilitas_ac BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fasilitas_ac_keterangan TEXT,
    ADD COLUMN IF NOT EXISTS fasilitas_lainnya VARCHAR(255),
    ADD COLUMN IF NOT EXISTS fasilitas_lainnya_keterangan TEXT;

-- ── Ketentuan dari Pengelola/Landlord/Pihak Ketiga ───────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS ketentuan_1 TEXT,
    ADD COLUMN IF NOT EXISTS ketentuan_2 TEXT,
    ADD COLUMN IF NOT EXISTS ketentuan_3 TEXT,
    ADD COLUMN IF NOT EXISTS ketentuan_4 TEXT,
    ADD COLUMN IF NOT EXISTS ketentuan_5 TEXT;

-- ── Catatan Design (Hasil Ukur & Kondisi Lingkungan) ─────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS catatan_design_1 TEXT,
    ADD COLUMN IF NOT EXISTS catatan_design_2 TEXT,
    ADD COLUMN IF NOT EXISTS catatan_design_3 TEXT,
    ADD COLUMN IF NOT EXISTS catatan_design_4 TEXT,
    ADD COLUMN IF NOT EXISTS catatan_design_5 TEXT;

-- ── Upload Files ─────────────────────────────────────────────────────────
ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS link_gambar_rab_sipil VARCHAR(500),
    ADD COLUMN IF NOT EXISTS link_gambar_rab_me VARCHAR(500);
