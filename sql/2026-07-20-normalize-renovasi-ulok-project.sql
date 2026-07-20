-- Normalize project label for renovation ULOK.
-- Business rule: every nomor_ulok ending with "-R" is Renovasi.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_normalize_renovasi_ulok_project_2026_07_20 (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id BIGINT NOT NULL,
    nomor_ulok TEXT NOT NULL,
    old_proyek TEXT,
    old_jenis_proyek TEXT,
    migrated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

WITH target AS (
    SELECT id, nomor_ulok, proyek AS old_proyek
    FROM toko
    WHERE TRIM(COALESCE(nomor_ulok, '')) ~* '-R$'
      AND UPPER(TRIM(COALESCE(proyek, ''))) <> 'RENOVASI'
),
changed AS (
    UPDATE toko t
    SET proyek = 'Renovasi'
    FROM target
    WHERE t.id = target.id
    RETURNING t.id, t.nomor_ulok, target.old_proyek
)
INSERT INTO audit_normalize_renovasi_ulok_project_2026_07_20 (
    table_name, record_id, nomor_ulok, old_proyek
)
SELECT 'toko', id, nomor_ulok, old_proyek
FROM changed;

WITH target AS (
    SELECT id, nomor_ulok, proyek AS old_proyek
    FROM pengajuan_spk
    WHERE TRIM(COALESCE(nomor_ulok, '')) ~* '-R$'
      AND UPPER(TRIM(COALESCE(proyek, ''))) <> 'RENOVASI'
),
changed AS (
    UPDATE pengajuan_spk p
    SET proyek = 'Renovasi'
    FROM target
    WHERE p.id = target.id
    RETURNING p.id, p.nomor_ulok, target.old_proyek
)
INSERT INTO audit_normalize_renovasi_ulok_project_2026_07_20 (
    table_name, record_id, nomor_ulok, old_proyek
)
SELECT 'pengajuan_spk', id, nomor_ulok, old_proyek
FROM changed;

WITH target AS (
    SELECT id, nomor_ulok, proyek AS old_proyek, jenis_proyek AS old_jenis_proyek
    FROM projek_planning
    WHERE TRIM(COALESCE(nomor_ulok, '')) ~* '-R$'
      AND (
          UPPER(TRIM(COALESCE(proyek, ''))) <> 'RENOVASI'
          OR UPPER(TRIM(COALESCE(jenis_proyek, ''))) <> 'RENOVASI'
      )
),
changed AS (
    UPDATE projek_planning p
    SET proyek = 'Renovasi',
        jenis_proyek = 'Renovasi'
    FROM target
    WHERE p.id = target.id
    RETURNING p.id, p.nomor_ulok, target.old_proyek, target.old_jenis_proyek
)
INSERT INTO audit_normalize_renovasi_ulok_project_2026_07_20 (
    table_name, record_id, nomor_ulok, old_proyek, old_jenis_proyek
)
SELECT 'projek_planning', id, nomor_ulok, old_proyek, old_jenis_proyek
FROM changed;

WITH target AS (
    SELECT id, nomor_ulok, proyek AS old_proyek
    FROM penyimpanan_dokumen_toko
    WHERE TRIM(COALESCE(nomor_ulok, '')) ~* '-R$'
      AND UPPER(TRIM(COALESCE(proyek, ''))) <> 'RENOVASI'
),
changed AS (
    UPDATE penyimpanan_dokumen_toko p
    SET proyek = 'Renovasi'
    FROM target
    WHERE p.id = target.id
    RETURNING p.id, p.nomor_ulok, target.old_proyek
)
INSERT INTO audit_normalize_renovasi_ulok_project_2026_07_20 (
    table_name, record_id, nomor_ulok, old_proyek
)
SELECT 'penyimpanan_dokumen_toko', id, nomor_ulok, old_proyek
FROM changed;

COMMIT;
