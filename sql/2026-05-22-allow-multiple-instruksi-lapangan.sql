-- Allow more than one Instruksi Lapangan per toko/ULOK.
-- No unique constraint exists on instruksi_lapangan.id_toko, so the DB already
-- supports multiple rows. This index speeds up per-toko status lookups used by
-- revision lists, approval lists, and Opname Final aggregation.

CREATE INDEX IF NOT EXISTS idx_instruksi_lapangan_toko_status_created
    ON instruksi_lapangan(id_toko, status, created_at DESC);
