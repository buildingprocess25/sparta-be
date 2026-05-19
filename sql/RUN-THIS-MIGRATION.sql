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
    ADD COLUMN IF NOT EXISTS link_gambar_kompetitor TEXT    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS alamat_toko TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_google_maps TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_gambar_kerja_final_sipil TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_gambar_kerja_final_me TEXT DEFAULT NULL;

DO $$
DECLARE
    constraint_name_to_drop text;
BEGIN
    FOR constraint_name_to_drop IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'projek_planning'
          AND kcu.column_name = 'id_toko'
          AND ccu.table_name = 'toko'
    LOOP
        EXECUTE format('ALTER TABLE projek_planning DROP CONSTRAINT IF EXISTS %I', constraint_name_to_drop);
    END LOOP;
END $$;

ALTER TABLE projek_planning
    ALTER COLUMN id_toko DROP NOT NULL;

UPDATE projek_planning
SET id_toko = 0
WHERE id_toko IS NULL;

UPDATE projek_planning
SET link_gambar_kerja_final_sipil = link_gambar_kerja_final
WHERE link_gambar_kerja_final_sipil IS NULL
  AND link_gambar_kerja_final IS NOT NULL;


-- ============================================================
-- [3] KOLOM BARU di tabel dokumentasi_bangunan_item
--     File asal: 2026-05-19-add-sudut-foto-dokumentasi-bangunan-item.sql
--     Kolom: sudut_foto
-- ============================================================
ALTER TABLE dokumentasi_bangunan_item
        ADD COLUMN IF NOT EXISTS sudut_foto VARCHAR(255);


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
      'link_gambar_kerja_final_sipil',
      'link_gambar_kerja_final_me',
      'alamat_toko',
      'is_ruko',
      'jumlah_lantai'
  )
ORDER BY column_name;

SELECT 'projek_planning_foto_item EXISTS: ' || COUNT(*)::text AS status
FROM information_schema.tables
WHERE table_name = 'projek_planning_foto_item';

-- ============================================================
-- [3] TABEL auth_otp
--     File asal: 2026-05-18-create-auth-otp.sql
--     Kolom: email_sat, cabang, otp_hash, otp_token, expires_at
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_otp (
    id SERIAL PRIMARY KEY,
    email_sat VARCHAR(255) NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    consumed_at TIMESTAMPTZ DEFAULT NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'expires_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN expires_at TYPE TIMESTAMPTZ
            USING expires_at AT TIME ZONE 'Asia/Jakarta';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'Asia/Jakarta';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'consumed_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN consumed_at TYPE TIMESTAMPTZ
            USING consumed_at AT TIME ZONE 'Asia/Jakarta';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_otp_lookup
    ON auth_otp (email_sat, cabang, otp_token);

CREATE INDEX IF NOT EXISTS idx_auth_otp_active
    ON auth_otp (email_sat, cabang, expires_at)
    WHERE consumed_at IS NULL;
