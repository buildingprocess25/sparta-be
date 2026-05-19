ALTER TABLE rab
    ADD COLUMN IF NOT EXISTS nama_persetujuan_koordinator VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nama_persetujuan_manager VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nama_persetujuan_direktur VARCHAR(255);
