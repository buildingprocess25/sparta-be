-- Migration: ubah kolom logo dan file_asuransi ke TEXT agar aman untuk link/base64

ALTER TABLE rab
    ALTER COLUMN logo TYPE TEXT,
    ALTER COLUMN file_asuransi TYPE TEXT;
