ALTER TABLE pengawasan
ADD COLUMN IF NOT EXISTS dokumentasi_base64 TEXT;

COMMENT ON COLUMN pengawasan.dokumentasi_base64 IS
'Data URL foto dokumentasi dari upload user untuk kebutuhan render PDF tanpa membaca ulang file dari Google Drive.';
