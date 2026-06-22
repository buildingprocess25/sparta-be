BEGIN;

ALTER TABLE berkas_serah_terima
    ADD COLUMN IF NOT EXISTS tanggal_serah_terima DATE;

UPDATE berkas_serah_terima
SET tanggal_serah_terima = created_at::date
WHERE tanggal_serah_terima IS NULL;

ALTER TABLE berkas_serah_terima
    ALTER COLUMN tanggal_serah_terima SET DEFAULT (timezone('Asia/Jakarta', now())::date);

CREATE INDEX IF NOT EXISTS idx_berkas_serah_terima_tanggal
    ON berkas_serah_terima (tanggal_serah_terima);

COMMIT;
