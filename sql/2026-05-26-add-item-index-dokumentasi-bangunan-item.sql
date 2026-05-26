-- Store the original photo point number so PDF attachment titles match the input.

ALTER TABLE dokumentasi_bangunan_item
    ADD COLUMN IF NOT EXISTS item_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_item_index
    ON dokumentasi_bangunan_item(id_dokumentasi_bangunan, item_index);
