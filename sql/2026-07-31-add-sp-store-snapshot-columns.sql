ALTER TABLE denda_keterlambatan_action
    ADD COLUMN IF NOT EXISTS nama_toko TEXT,
    ADD COLUMN IF NOT EXISTS kode_toko TEXT;
