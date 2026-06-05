-- Allow decimal quantities for Instruksi Lapangan items.
-- Required for values such as 3,65 / 3.65.

ALTER TABLE instruksi_lapangan_item
    ALTER COLUMN volume TYPE DOUBLE PRECISION
    USING NULLIF(REPLACE(volume::text, ',', '.'), '')::double precision;
