-- Allow decimal totals for Instruksi Lapangan items.
-- Decimal volumes can produce fractional rupiah values before the existing
-- display/PDF rounding and grand-total pembulatan are applied.

ALTER TABLE instruksi_lapangan_item
    ALTER COLUMN total_material TYPE NUMERIC(18,2)
        USING NULLIF(REPLACE(total_material::text, ',', '.'), '')::numeric(18,2),
    ALTER COLUMN total_upah TYPE NUMERIC(18,2)
        USING NULLIF(REPLACE(total_upah::text, ',', '.'), '')::numeric(18,2),
    ALTER COLUMN total_harga TYPE NUMERIC(18,2)
        USING NULLIF(REPLACE(total_harga::text, ',', '.'), '')::numeric(18,2);
