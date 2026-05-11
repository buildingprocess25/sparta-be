ALTER TABLE instruksi_lapangan
    ADD COLUMN IF NOT EXISTS tanggal_mulai DATE,
    ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;
