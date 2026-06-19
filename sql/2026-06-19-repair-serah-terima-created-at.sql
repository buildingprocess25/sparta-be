BEGIN;

CREATE TABLE IF NOT EXISTS berkas_serah_terima_created_at_repair_audit (
    berkas_serah_terima_id INT PRIMARY KEY,
    id_toko INT NOT NULL,
    old_created_at TIMESTAMP NOT NULL,
    repaired_created_at TIMESTAMP NOT NULL,
    repair_source VARCHAR(50) NOT NULL,
    repaired_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

WITH repair_candidates AS (
    SELECT
        bst.id AS berkas_serah_terima_id,
        bst.id_toko,
        bst.created_at AS old_created_at,
        COALESCE(opname_items.last_item_created_at, opname_latest.created_at) AS repaired_created_at,
        CASE
            WHEN opname_items.last_item_created_at IS NOT NULL THEN 'LAST_OPNAME_ITEM'
            ELSE 'OPNAME_FINAL_HEADER'
        END AS repair_source
    FROM berkas_serah_terima bst
    LEFT JOIN LATERAL (
        SELECT id, created_at
        FROM opname_final
        WHERE id_toko = bst.id_toko
        ORDER BY id DESC
        LIMIT 1
    ) opname_latest ON true
    LEFT JOIN LATERAL (
        SELECT MAX(created_at) AS last_item_created_at
        FROM opname_item
        WHERE id_opname_final = opname_latest.id
    ) opname_items ON true
    WHERE bst.created_at::time = TIME '00:00:00'
      AND COALESCE(opname_items.last_item_created_at, opname_latest.created_at) IS NOT NULL
),
audit_insert AS (
    INSERT INTO berkas_serah_terima_created_at_repair_audit (
        berkas_serah_terima_id,
        id_toko,
        old_created_at,
        repaired_created_at,
        repair_source
    )
    SELECT
        berkas_serah_terima_id,
        id_toko,
        old_created_at,
        repaired_created_at,
        repair_source
    FROM repair_candidates
    ON CONFLICT (berkas_serah_terima_id) DO NOTHING
    RETURNING berkas_serah_terima_id
)
UPDATE berkas_serah_terima bst
SET created_at = candidate.repaired_created_at
FROM repair_candidates candidate
WHERE bst.id = candidate.berkas_serah_terima_id
  AND bst.created_at::time = TIME '00:00:00';

COMMIT;
