BEGIN;

CREATE TABLE IF NOT EXISTS rab_scope_fix_audit (
    rab_id INT PRIMARY KEY,
    nomor_ulok VARCHAR(255) NOT NULL,
    lingkup_pekerjaan VARCHAR(50) NOT NULL,
    old_rab JSONB NOT NULL,
    old_items JSONB NOT NULL,
    old_spk JSONB NOT NULL,
    fixed_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

INSERT INTO rab_scope_fix_audit (
    rab_id,
    nomor_ulok,
    lingkup_pekerjaan,
    old_rab,
    old_items,
    old_spk
)
SELECT
    r.id,
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    to_jsonb(r),
    COALESCE((
        SELECT jsonb_agg(to_jsonb(ri) ORDER BY ri.id)
        FROM rab_item ri
        WHERE ri.id_rab = r.id
    ), '[]'::jsonb),
    COALESCE((
        SELECT jsonb_agg(to_jsonb(ps) ORDER BY ps.id)
        FROM pengajuan_spk ps
        WHERE ps.id_toko = r.id_toko
    ), '[]'::jsonb)
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE r.id IN (2132, 2133)
  AND t.nomor_ulok = 'LZ01-2604-L744-R'
ON CONFLICT (rab_id) DO NOTHING;

DELETE FROM rab_item
WHERE id_rab = 2132
  AND id NOT BETWEEN 35795 AND 35813;

DELETE FROM rab_item
WHERE id_rab = 2133
  AND id NOT BETWEEN 35814 AND 35819;

UPDATE rab
SET grand_total = 35272667,
    grand_total_non_sbo = 35272667,
    grand_total_final = 39149700
WHERE id = 2132
  AND id_toko = 1384;

UPDATE rab
SET grand_total = 3272500,
    grand_total_non_sbo = 3272500,
    grand_total_final = 3629700
WHERE id = 2133
  AND id_toko = 1385;

UPDATE pengajuan_spk
SET grand_total = CASE id_toko
        WHEN 1384 THEN 39149700
        WHEN 1385 THEN 3629700
    END,
    terbilang = CASE id_toko
        WHEN 1384 THEN 'Tiga Puluh Sembilan Juta Seratus Empat Puluh Sembilan Ribu Tujuh Ratus Rupiah'
        WHEN 1385 THEN 'Tiga Juta Enam Ratus Dua Puluh Sembilan Ribu Tujuh Ratus Rupiah'
    END
WHERE id_toko IN (1384, 1385)
  AND status = 'WAITING_FOR_BM_APPROVAL';

DO $$
DECLARE
    sipil_item_total NUMERIC;
    me_item_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_harga::numeric), 0)
    INTO sipil_item_total
    FROM rab_item
    WHERE id_rab = 2132;

    SELECT COALESCE(SUM(total_harga::numeric), 0)
    INTO me_item_total
    FROM rab_item
    WHERE id_rab = 2133;

    IF sipil_item_total <> 35272667 THEN
        RAISE EXCEPTION 'Total item SIPIL setelah koreksi tidak sesuai: %', sipil_item_total;
    END IF;

    IF me_item_total <> 3272500 THEN
        RAISE EXCEPTION 'Total item ME setelah koreksi tidak sesuai: %', me_item_total;
    END IF;
END $$;

COMMIT;
