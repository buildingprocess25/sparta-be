-- ============================================================
-- SPARTA RAB & GANTT CHART Schema
-- ============================================================

-- 1) TOKO
CREATE TABLE toko (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(255) UNIQUE,
    lingkup_pekerjaan VARCHAR(255),
    nama_toko VARCHAR(255),
    kode_toko VARCHAR(255),
    proyek VARCHAR(255),
    cabang VARCHAR(255),
    alamat VARCHAR(255),
    nama_kontraktor VARCHAR(255)
);

-- 2) RAB
CREATE TABLE rab (
    id SERIAL PRIMARY KEY,
    id_toko INT,
    no_sph INT,
    status VARCHAR(255),
    nama_pt VARCHAR(255),
    link_pdf_gabungan VARCHAR(255),
    link_pdf_non_sbo VARCHAR(255),
    link_pdf_rekapitulasi VARCHAR(255),
    link_pdf_sph VARCHAR(255),
    logo VARCHAR(255),
    email_pembuat VARCHAR(255),
    pemberi_persetujuan_direktur VARCHAR(255),
    waktu_persetujuan_direktur TIMESTAMP,
    pemberi_persetujuan_koordinator VARCHAR(255),
    waktu_persetujuan_koordinator TIMESTAMP,
    pemberi_persetujuan_manager VARCHAR(255),
    waktu_persetujuan_manager TIMESTAMP,
    alasan_penolakan VARCHAR(255),
    ditolak_oleh VARCHAR(255),
    durasi_pekerjaan VARCHAR(255),
    kategori_lokasi VARCHAR(255),
    no_polis VARCHAR(255),
    berlaku_polis VARCHAR(255),
    file_asuransi VARCHAR(500),
    luas_bangunan VARCHAR(255),
    luas_terbangun VARCHAR(255),
    luas_area_terbuka VARCHAR(255),
    luas_area_parkir VARCHAR(255),
    luas_area_sales VARCHAR(255),
    luas_gudang VARCHAR(255),
    grand_total VARCHAR(255),
    grand_total_non_sbo VARCHAR(255),
    grand_total_final VARCHAR(255),
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

-- Jika tabel rab sudah terlanjur ada di environment lama, jalankan migration berikut:
-- ALTER TABLE rab
--   ADD COLUMN IF NOT EXISTS no_sph INT,
--   ADD COLUMN IF NOT EXISTS link_pdf_sph VARCHAR(255),
--   ADD COLUMN IF NOT EXISTS no_polis VARCHAR(255),
--   ADD COLUMN IF NOT EXISTS berlaku_polis VARCHAR(255),
--   ADD COLUMN IF NOT EXISTS file_asuransi VARCHAR(500),
--   ADD COLUMN IF NOT EXISTS ditolak_oleh VARCHAR(255),
--   ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp,
--   ALTER COLUMN waktu_persetujuan_koordinator TYPE TIMESTAMP
--       USING CASE
--           WHEN waktu_persetujuan_koordinator IS NULL OR waktu_persetujuan_koordinator = '' THEN NULL
--           ELSE (waktu_persetujuan_koordinator::timestamptz AT TIME ZONE 'Asia/Jakarta')
--       END,
--   ALTER COLUMN waktu_persetujuan_manager TYPE TIMESTAMP
--       USING CASE
--           WHEN waktu_persetujuan_manager IS NULL OR waktu_persetujuan_manager = '' THEN NULL
--           ELSE (waktu_persetujuan_manager::timestamptz AT TIME ZONE 'Asia/Jakarta')
--       END,
--   ALTER COLUMN waktu_persetujuan_direktur TYPE TIMESTAMP
--       USING CASE
--           WHEN waktu_persetujuan_direktur IS NULL OR waktu_persetujuan_direktur = '' THEN NULL
--           ELSE (waktu_persetujuan_direktur::timestamptz AT TIME ZONE 'Asia/Jakarta')
--       END;

-- 3) RAB_ITEM
CREATE TABLE rab_item (
    id SERIAL PRIMARY KEY,
    id_rab INT,
    kategori_pekerjaan VARCHAR(255),
    jenis_pekerjaan VARCHAR(255),
    satuan VARCHAR(50),
    volume INTEGER,
    harga_material INTEGER,
    harga_upah INTEGER,
    total_material INTEGER,
    total_upah INTEGER,
    total_harga INTEGER,
    catatan VARCHAR(255),
    CONSTRAINT fk_rab FOREIGN KEY (id_rab) REFERENCES rab(id) ON DELETE CASCADE
);

-- Jika tabel rab_item sudah terlanjur ada di environment lama, jalankan migration berikut:
-- ALTER TABLE rab_item
--   ADD COLUMN IF NOT EXISTS catatan VARCHAR(255);

-- 4) USER_CABANG (tabel pendukung untuk login)
CREATE TABLE IF NOT EXISTS user_cabang (
    id SERIAL PRIMARY KEY,
    cabang VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(255),
    jabatan VARCHAR(255),
    email_sat VARCHAR(255) NOT NULL,
    nama_pt VARCHAR(255),
    CONSTRAINT uq_user_cabang_email_cabang UNIQUE (email_sat, cabang)
);

-- ============================================================
-- GANTT CHART TABLES
-- ============================================================

-- 5) GANTT_CHART
CREATE TABLE gantt_chart (
    id SERIAL PRIMARY KEY,
    id_toko INT,
    status VARCHAR(255), -- (misal: active/terkunci)
    email_pembuat VARCHAR(255),
    timestamp DATE,
    CONSTRAINT fk_gantt_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

-- 6) KATEGORI_PEKERJAAN_GANTT
CREATE TABLE kategori_pekerjaan_gantt (
    id SERIAL PRIMARY KEY,
    id_gantt INT,
    kategori_pekerjaan VARCHAR(255),
    CONSTRAINT fk_kategori_gantt FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE
);

-- 7) DAY_GANTT_CHART
CREATE TABLE day_gantt_chart (
    id SERIAL PRIMARY KEY,
    id_gantt INT,
    id_kategori_pekerjaan_gantt INT,
    h_awal VARCHAR(255),
    h_akhir VARCHAR(255),
    keterlambatan VARCHAR(255),
    kecepatan VARCHAR(255),
    CONSTRAINT fk_day_gantt FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE,
    CONSTRAINT fk_day_kategori_pekerjaan FOREIGN KEY (id_kategori_pekerjaan_gantt) REFERENCES kategori_pekerjaan_gantt(id) ON DELETE CASCADE
);

-- 8) PENGAWASAN_GANTT
CREATE TABLE pengawasan_gantt (
    id SERIAL PRIMARY KEY,
    id_gantt INT,
    tanggal_pengawasan VARCHAR(255),
    CONSTRAINT fk_pengawasan_gantt FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE
);

-- Jika tabel pengawasan_gantt sudah ada di environment lama, jalankan migration berikut:
-- ALTER TABLE pengawasan_gantt
--   RENAME COLUMN kategori_pekerjaan TO tanggal_pengawasan;

-- 8a) PENGAWASAN (detail pekerjaan pengawasan)
CREATE TABLE IF NOT EXISTS pengawasan (
    id SERIAL PRIMARY KEY,
    id_gantt INT NOT NULL,
    id_pengawasan_gantt INT,
    kategori_pekerjaan VARCHAR(255) NOT NULL,
    jenis_pekerjaan VARCHAR(255) NOT NULL,
    catatan VARCHAR(500),
    dokumentasi VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'progress',
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_pengawasan_gantt FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE,
    CONSTRAINT fk_pengawasan_pengawasan_gantt_ref FOREIGN KEY (id_pengawasan_gantt) REFERENCES pengawasan_gantt(id),
    CONSTRAINT chk_pengawasan_status CHECK (status IN ('progress', 'selesai', 'terlambat'))
);

CREATE INDEX IF NOT EXISTS idx_pengawasan_id_gantt ON pengawasan(id_gantt);
CREATE INDEX IF NOT EXISTS idx_pengawasan_id_pengawasan_gantt ON pengawasan(id_pengawasan_gantt);
CREATE INDEX IF NOT EXISTS idx_pengawasan_status ON pengawasan(status);

-- Migration safety untuk environment yang tabelnya sudah ada tetapi belum lengkap.
ALTER TABLE pengawasan
    ADD COLUMN IF NOT EXISTS kategori_pekerjaan VARCHAR(255),
    ADD COLUMN IF NOT EXISTS jenis_pekerjaan VARCHAR(255),
    ADD COLUMN IF NOT EXISTS id_pengawasan_gantt INT,
    ADD COLUMN IF NOT EXISTS catatan VARCHAR(500),
    ADD COLUMN IF NOT EXISTS dokumentasi VARCHAR(500),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'progress',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now());

ALTER TABLE pengawasan
    ALTER COLUMN status SET DEFAULT 'progress';

UPDATE pengawasan
SET status = 'progress'
WHERE status IS NULL OR status = 'active';

UPDATE pengawasan
SET status = 'selesai'
WHERE status = 'terkunci';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pengawasan'
          AND column_name = 'id_pengawasan_gantt'
    ) THEN
        ALTER TABLE pengawasan
        ADD COLUMN id_pengawasan_gantt INT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_pengawasan_gantt'
          AND table_name = 'pengawasan'
    ) THEN
        ALTER TABLE pengawasan
        ADD CONSTRAINT fk_pengawasan_gantt
        FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_pengawasan_pengawasan_gantt_ref'
          AND table_name = 'pengawasan'
    ) THEN
        ALTER TABLE pengawasan
        ADD CONSTRAINT fk_pengawasan_pengawasan_gantt_ref
        FOREIGN KEY (id_pengawasan_gantt) REFERENCES pengawasan_gantt(id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_pengawasan_status'
          AND table_name = 'pengawasan'
    ) THEN
        ALTER TABLE pengawasan
        DROP CONSTRAINT chk_pengawasan_status;
    END IF;

    ALTER TABLE pengawasan
        ADD CONSTRAINT chk_pengawasan_status
        CHECK (status IN ('progress', 'selesai', 'terlambat'));
END $$;

CREATE INDEX IF NOT EXISTS idx_pengawasan_id_pengawasan_gantt ON pengawasan(id_pengawasan_gantt);

-- 8a-ii) BERKAS_PENGAWASAN (relasi 1-ke-1 dengan pengawasan_gantt)
CREATE TABLE IF NOT EXISTS berkas_pengawasan (
    id SERIAL PRIMARY KEY,
    id_pengawasan_gantt INT NOT NULL UNIQUE,
    link_pdf_pengawasan VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_berkas_pengawasan_gantt FOREIGN KEY (id_pengawasan_gantt) REFERENCES pengawasan_gantt(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_berkas_pengawasan_id_pengawasan_gantt ON berkas_pengawasan(id_pengawasan_gantt);

-- Migration safety untuk environment yang tabelnya sudah ada tetapi belum lengkap.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_berkas_pengawasan_gantt'
          AND table_name = 'berkas_pengawasan'
    ) THEN
        ALTER TABLE berkas_pengawasan
        ADD CONSTRAINT fk_berkas_pengawasan_gantt
        FOREIGN KEY (id_pengawasan_gantt) REFERENCES pengawasan_gantt(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 8b) OPNAME_FINAL (header approval untuk hasil opname)
CREATE TABLE IF NOT EXISTS opname_final (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    status_opname_final VARCHAR(255) NOT NULL DEFAULT 'Menunggu Persetujuan Koordinator',
    link_pdf_opname VARCHAR(500),
    email_pembuat VARCHAR(255),
    pemberi_persetujuan_direktur VARCHAR(255),
    waktu_persetujuan_direktur VARCHAR(255),
    pemberi_persetujuan_koordinator VARCHAR(255),
    waktu_persetujuan_koordinator VARCHAR(255),
    pemberi_persetujuan_manager VARCHAR(255),
    waktu_persetujuan_manager VARCHAR(255),
    alasan_penolakan VARCHAR(255),
    grand_total_opname VARCHAR(255),
    grand_total_rab VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_opname_final_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opname_final_id_toko ON opname_final(id_toko);
CREATE INDEX IF NOT EXISTS idx_opname_final_status ON opname_final(status_opname_final);

-- Migration safety: pastikan default status mengikuti alur approval terbaru.
ALTER TABLE opname_final
    ALTER COLUMN status_opname_final SET DEFAULT 'Menunggu Persetujuan Koordinator';

-- 8c) OPNAME_ITEM (rename dari tabel opname lama)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'opname'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname RENAME TO opname_item;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS opname_item (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    id_opname_final INT NOT NULL,
    id_rab_item INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    volume_akhir INTEGER NOT NULL,
    selisih_volume INTEGER NOT NULL,
    total_selisih INTEGER NOT NULL,
    desain VARCHAR(255),
    kualitas VARCHAR(255),
    spesifikasi VARCHAR(255),
    foto VARCHAR(500),
    catatan VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_opname_item_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE,
    CONSTRAINT fk_opname_item_opname_final FOREIGN KEY (id_opname_final) REFERENCES opname_final(id) ON DELETE CASCADE,
    CONSTRAINT fk_opname_item_rab_item FOREIGN KEY (id_rab_item) REFERENCES rab_item(id) ON DELETE CASCADE,
    CONSTRAINT chk_opname_item_status CHECK (status IN ('pending', 'disetujui', 'ditolak'))
);

CREATE INDEX IF NOT EXISTS idx_opname_item_id_toko ON opname_item(id_toko);
CREATE INDEX IF NOT EXISTS idx_opname_item_id_opname_final ON opname_item(id_opname_final);
CREATE INDEX IF NOT EXISTS idx_opname_item_id_rab_item ON opname_item(id_rab_item);

-- Migration safety untuk environment lama (dari tabel opname lama).
ALTER TABLE opname_item
    ADD COLUMN IF NOT EXISTS id_toko INT,
    ADD COLUMN IF NOT EXISTS id_opname_final INT,
    ADD COLUMN IF NOT EXISTS id_rab_item INT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS volume_akhir INTEGER,
    ADD COLUMN IF NOT EXISTS selisih_volume INTEGER,
    ADD COLUMN IF NOT EXISTS total_selisih INTEGER,
    ADD COLUMN IF NOT EXISTS desain VARCHAR(255),
    ADD COLUMN IF NOT EXISTS kualitas VARCHAR(255),
    ADD COLUMN IF NOT EXISTS spesifikasi VARCHAR(255),
    ADD COLUMN IF NOT EXISTS foto VARCHAR(500),
    ADD COLUMN IF NOT EXISTS catatan VARCHAR(500),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'opname_item'
          AND column_name = 'id_opname_final'
    ) THEN
        ALTER TABLE opname_item
        ADD COLUMN id_opname_final INT;
    END IF;

    -- Backfill header opname_final jika kolom id_opname_final belum terisi.
    INSERT INTO opname_final (id_toko, status_opname_final, email_pembuat, created_at)
    SELECT DISTINCT oi.id_toko,
        'Menunggu Persetujuan Koordinator',
        NULL,
        timezone('Asia/Jakarta', now())
    FROM opname_item oi
        WHERE oi.id_opname_final IS NULL
            AND oi.id_toko IS NOT NULL;

    UPDATE opname_item oi
    SET id_opname_final = ofn.id
    FROM opname_final ofn
    WHERE oi.id_opname_final IS NULL
      AND ofn.id_toko = oi.id_toko
            AND ofn.status_opname_final = 'Menunggu Persetujuan Koordinator';

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opname_toko'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT fk_opname_toko;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opname_rab_item'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT fk_opname_rab_item;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_opname_status'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT chk_opname_status;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opname_item_toko'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT fk_opname_item_toko;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opname_item_opname_final'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT fk_opname_item_opname_final;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opname_item_rab_item'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT fk_opname_item_rab_item;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_opname_item_status'
          AND table_name = 'opname_item'
    ) THEN
        ALTER TABLE opname_item DROP CONSTRAINT chk_opname_item_status;
    END IF;

    ALTER TABLE opname_item
        DROP COLUMN IF EXISTS kategori_pekerjaan,
        DROP COLUMN IF EXISTS jenis_pekerjaan,
        DROP COLUMN IF EXISTS satuan,
        DROP COLUMN IF EXISTS volume,
        DROP COLUMN IF EXISTS harga_material,
        DROP COLUMN IF EXISTS harga_upah;

    UPDATE opname_item
    SET status = 'pending'
    WHERE status IS NULL OR status = 'progress';

    UPDATE opname_item
    SET status = 'disetujui'
    WHERE status = 'selesai';

    UPDATE opname_item
    SET status = 'ditolak'
    WHERE status = 'terlambat';

    UPDATE opname_item
    SET status = 'pending'
    WHERE status IS NULL OR status NOT IN ('pending', 'disetujui', 'ditolak');

    ALTER TABLE opname_item
        ALTER COLUMN status SET DEFAULT 'pending',
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN id_toko SET NOT NULL,
        ALTER COLUMN id_opname_final SET NOT NULL,
        ALTER COLUMN id_rab_item SET NOT NULL;

    ALTER TABLE opname_item
        ADD CONSTRAINT fk_opname_item_toko
        FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE;

    ALTER TABLE opname_item
        ADD CONSTRAINT fk_opname_item_opname_final
        FOREIGN KEY (id_opname_final) REFERENCES opname_final(id) ON DELETE CASCADE;

    ALTER TABLE opname_item
        ADD CONSTRAINT fk_opname_item_rab_item
        FOREIGN KEY (id_rab_item) REFERENCES rab_item(id) ON DELETE CASCADE;

    ALTER TABLE opname_item
        ADD CONSTRAINT chk_opname_item_status
        CHECK (status IN ('pending', 'disetujui', 'ditolak'));
END $$;

-- 9) DEPENDENCY_GANTT
CREATE TABLE dependency_gantt (
    id SERIAL PRIMARY KEY,
    id_gantt INT,
    id_kategori INT,
    id_kategori_terikat INT,
    CONSTRAINT fk_dependency_gantt FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE,
    CONSTRAINT fk_dependency_kategori FOREIGN KEY (id_kategori) REFERENCES kategori_pekerjaan_gantt(id) ON DELETE CASCADE,
    CONSTRAINT fk_dependency_kategori_terikat FOREIGN KEY (id_kategori_terikat) REFERENCES kategori_pekerjaan_gantt(id) ON DELETE CASCADE
);

-- ============================================================
-- SPK TABLES (sesuai implementasi sparta-be/src/modules/spk)
-- ============================================================

-- 10) PENGAJUAN_SPK
CREATE TABLE pengajuan_spk (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    nomor_ulok VARCHAR(255) NOT NULL,
    email_pembuat VARCHAR(255) NOT NULL,
    lingkup_pekerjaan VARCHAR(255) NOT NULL,
    nama_kontraktor VARCHAR(255) NOT NULL,
    proyek VARCHAR(255) NOT NULL,
    waktu_mulai DATE NOT NULL,
    durasi INTEGER NOT NULL CHECK (durasi > 0),
    waktu_selesai TIMESTAMPTZ NOT NULL,
    grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
    terbilang VARCHAR(500) NOT NULL,
    nomor_spk VARCHAR(255) NOT NULL,
    par VARCHAR(255),
    spk_manual_1 VARCHAR(255),
    spk_manual_2 VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    link_pdf VARCHAR(500),
    approver_email VARCHAR(255),
    waktu_persetujuan TIMESTAMPTZ,
    alasan_penolakan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pengajuan_spk_id_toko UNIQUE (id_toko),
    CONSTRAINT fk_pengajuan_spk_toko_id FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE,
    CONSTRAINT fk_pengajuan_spk_toko_ulok FOREIGN KEY (nomor_ulok) REFERENCES toko(nomor_ulok) ON DELETE CASCADE
);

-- 11) SPK_APPROVAL_LOG
CREATE TABLE spk_approval_log (
    id SERIAL PRIMARY KEY,
    pengajuan_spk_id INT NOT NULL,
    approver_email VARCHAR(255) NOT NULL,
    tindakan VARCHAR(20) NOT NULL,
    alasan_penolakan TEXT,
    waktu_tindakan TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_spk_approval_log_pengajuan FOREIGN KEY (pengajuan_spk_id) REFERENCES pengajuan_spk(id) ON DELETE CASCADE,
    CONSTRAINT chk_spk_approval_log_tindakan CHECK (tindakan IN ('APPROVE', 'REJECT'))
);

CREATE INDEX idx_pengajuan_spk_status ON pengajuan_spk(status);
CREATE INDEX idx_pengajuan_spk_id_toko ON pengajuan_spk(id_toko);
CREATE INDEX idx_pengajuan_spk_nomor_ulok ON pengajuan_spk(nomor_ulok);
CREATE INDEX idx_pengajuan_spk_created_at ON pengajuan_spk(created_at);
CREATE INDEX idx_spk_approval_log_pengajuan_spk_id ON spk_approval_log(pengajuan_spk_id);

DO $$
DECLARE
    v_missing_count INT;
    v_invalid_fk_count INT;
    v_duplicate_toko_count INT;
    v_row RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pengajuan_spk'
          AND column_name = 'id_toko'
    ) THEN
        ALTER TABLE pengajuan_spk ADD COLUMN id_toko INT;
    END IF;

    -- Normalisasi nilai ULOK agar mapping tidak gagal karena spasi.
    UPDATE pengajuan_spk
    SET nomor_ulok = BTRIM(nomor_ulok)
    WHERE nomor_ulok IS NOT NULL
      AND nomor_ulok <> BTRIM(nomor_ulok);

    UPDATE toko
    SET nomor_ulok = BTRIM(nomor_ulok)
    WHERE nomor_ulok IS NOT NULL
      AND nomor_ulok <> BTRIM(nomor_ulok);

    UPDATE pengajuan_spk p
    SET id_toko = t.id
    FROM toko t
    WHERE p.id_toko IS NULL
      AND t.nomor_ulok = p.nomor_ulok;

    SELECT COUNT(*) INTO v_missing_count
    FROM pengajuan_spk
    WHERE id_toko IS NULL;

    IF v_missing_count > 0 THEN
        RAISE NOTICE 'Baris gagal mapping id_toko (id, nomor_ulok):';
        FOR v_row IN
            SELECT p.id, p.nomor_ulok
            FROM pengajuan_spk p
            WHERE p.id_toko IS NULL
            ORDER BY p.id
        LOOP
            RAISE NOTICE '  id=%, nomor_ulok=%', v_row.id, v_row.nomor_ulok;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_invalid_fk_count
    FROM pengajuan_spk p
    LEFT JOIN toko t ON t.id = p.id_toko
    WHERE p.id_toko IS NOT NULL
      AND t.id IS NULL;

    IF v_invalid_fk_count > 0 THEN
        RAISE NOTICE 'Baris dengan id_toko tidak valid (id, id_toko):';
        FOR v_row IN
            SELECT p.id, p.id_toko
            FROM pengajuan_spk p
            LEFT JOIN toko t ON t.id = p.id_toko
            WHERE p.id_toko IS NOT NULL
              AND t.id IS NULL
            ORDER BY p.id
        LOOP
            RAISE NOTICE '  id=%, id_toko=%', v_row.id, v_row.id_toko;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_duplicate_toko_count
    FROM (
        SELECT id_toko
        FROM pengajuan_spk
        WHERE id_toko IS NOT NULL
        GROUP BY id_toko
        HAVING COUNT(*) > 1
    ) dup;

    IF v_duplicate_toko_count > 0 THEN
        RAISE NOTICE 'Duplikasi id_toko ditemukan (id_toko -> jumlah data):';
        FOR v_row IN
            SELECT id_toko, COUNT(*) AS jumlah
            FROM pengajuan_spk
            WHERE id_toko IS NOT NULL
            GROUP BY id_toko
            HAVING COUNT(*) > 1
            ORDER BY id_toko
        LOOP
            RAISE NOTICE '  id_toko=%, jumlah=%', v_row.id_toko, v_row.jumlah;
        END LOOP;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pengajuan_spk'
          AND column_name = 'id_toko'
          AND is_nullable = 'YES'
    ) AND v_missing_count = 0 THEN
        ALTER TABLE pengajuan_spk ALTER COLUMN id_toko SET NOT NULL;
    ELSIF v_missing_count > 0 THEN
        RAISE NOTICE 'Lewati SET NOT NULL: masih ada % baris id_toko NULL', v_missing_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'pengajuan_spk'
          AND constraint_name = 'uq_pengajuan_spk_id_toko'
    ) AND v_missing_count = 0 AND v_duplicate_toko_count = 0 THEN
        ALTER TABLE pengajuan_spk
        ADD CONSTRAINT uq_pengajuan_spk_id_toko UNIQUE (id_toko);
    ELSIF v_duplicate_toko_count > 0 THEN
        RAISE NOTICE 'Lewati UNIQUE uq_pengajuan_spk_id_toko: masih ada duplikasi id_toko';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'pengajuan_spk'
          AND constraint_name = 'fk_pengajuan_spk_toko_id'
    ) AND v_invalid_fk_count = 0 THEN
        ALTER TABLE pengajuan_spk
        ADD CONSTRAINT fk_pengajuan_spk_toko_id
        FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE;
    ELSIF v_invalid_fk_count > 0 THEN
        RAISE NOTICE 'Lewati FK fk_pengajuan_spk_toko_id: masih ada id_toko yang tidak valid';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pengajuan_spk_id_toko ON pengajuan_spk(id_toko);

-- 12) PERTAMBAHAN_SPK
-- ERD menamai relasi ke tabel `spk`; pada implementasi sparta-be relasi diarahkan ke `pengajuan_spk`.
CREATE TABLE IF NOT EXISTS pertambahan_spk (
    id SERIAL PRIMARY KEY,
    id_spk INT NOT NULL,
    pertambahan_hari VARCHAR(255) NOT NULL,
    tanggal_spk_akhir VARCHAR(255) NOT NULL,
    tanggal_spk_akhir_setelah_perpanjangan VARCHAR(255) NOT NULL,
    alasan_perpanjangan VARCHAR(500) NOT NULL,
    dibuat_oleh VARCHAR(255) NOT NULL,
    status_persetujuan VARCHAR(255) NOT NULL,
    disetujui_oleh VARCHAR(255),
    waktu_persetujuan TIMESTAMP,
    alasan_penolakan VARCHAR(500),
    link_pdf VARCHAR(500),
    link_lampiran_pendukung VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_pertambahan_spk_pengajuan_spk FOREIGN KEY (id_spk) REFERENCES pengajuan_spk(id) ON DELETE CASCADE
);

-- Migration safety untuk environment yang tabelnya sudah ada tetapi FK belum dibuat.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_pertambahan_spk_pengajuan_spk'
          AND table_name = 'pertambahan_spk'
    ) THEN
        ALTER TABLE pertambahan_spk
        ADD CONSTRAINT fk_pertambahan_spk_pengajuan_spk
        FOREIGN KEY (id_spk) REFERENCES pengajuan_spk(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pertambahan_spk_id_spk ON pertambahan_spk(id_spk);
CREATE INDEX IF NOT EXISTS idx_pertambahan_spk_status_persetujuan ON pertambahan_spk(status_persetujuan);
CREATE INDEX IF NOT EXISTS idx_pertambahan_spk_created_at ON pertambahan_spk(created_at);

-- 13) PIC_PENGAWASAN
CREATE TABLE IF NOT EXISTS pic_pengawasan (
    id SERIAL PRIMARY KEY,
    nomor_ulok VARCHAR(255) NOT NULL UNIQUE,
    id_rab INT NOT NULL UNIQUE,
    id_spk INT NOT NULL UNIQUE,
    kategori_lokasi VARCHAR(255) NOT NULL,
    durasi VARCHAR(255) NOT NULL,
    tanggal_mulai_spk VARCHAR(255) NOT NULL,
    plc_building_support VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_pic_pengawasan_toko_ulok FOREIGN KEY (nomor_ulok) REFERENCES toko(nomor_ulok) ON DELETE CASCADE,
    CONSTRAINT fk_pic_pengawasan_rab FOREIGN KEY (id_rab) REFERENCES rab(id) ON DELETE CASCADE,
    CONSTRAINT fk_pic_pengawasan_spk FOREIGN KEY (id_spk) REFERENCES pengajuan_spk(id) ON DELETE CASCADE
);