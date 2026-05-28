ALTER TABLE opname_item
    ALTER COLUMN volume_akhir TYPE DOUBLE PRECISION USING volume_akhir::double precision,
    ALTER COLUMN selisih_volume TYPE DOUBLE PRECISION USING selisih_volume::double precision;
