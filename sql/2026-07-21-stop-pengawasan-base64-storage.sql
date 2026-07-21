-- Stop storing Pengawasan image data URLs in PostgreSQL.
-- Safe condition: every cleared row must already have a Drive link in `dokumentasi`.
--
-- Recommended flow:
-- 1. Deploy backend change that resolves PDF images from Drive first.
-- 2. Run the verification SELECTs below.
-- 3. Run the UPDATE.
-- 4. Reclaim physical disk in a maintenance window with VACUUM FULL or pg_repack.

SELECT
    COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(dokumentasi_base64, '')), '') IS NOT NULL
    ) AS rows_with_base64,
    COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(dokumentasi_base64, '')), '') IS NOT NULL
          AND NULLIF(TRIM(COALESCE(dokumentasi, '')), '') IS NOT NULL
    ) AS rows_with_base64_and_drive_link,
    COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(dokumentasi_base64, '')), '') IS NOT NULL
          AND NULLIF(TRIM(COALESCE(dokumentasi, '')), '') IS NULL
    ) AS rows_base64_only,
    pg_size_pretty(COALESCE(SUM(octet_length(dokumentasi_base64)), 0)::bigint) AS base64_payload_size
FROM pengawasan;

UPDATE pengawasan
SET dokumentasi_base64 = NULL
WHERE NULLIF(TRIM(COALESCE(dokumentasi_base64, '')), '') IS NOT NULL
  AND NULLIF(TRIM(COALESCE(dokumentasi, '')), '') IS NOT NULL;

SELECT
    COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(dokumentasi_base64, '')), '') IS NOT NULL
    ) AS remaining_rows_with_base64,
    pg_size_pretty(COALESCE(SUM(octet_length(dokumentasi_base64)), 0)::bigint) AS remaining_base64_payload_size
FROM pengawasan;
