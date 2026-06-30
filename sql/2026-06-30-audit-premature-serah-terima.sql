-- Audit Serah Terima yang terlanjur dibuat sebelum seluruh checkpoint pengawasan selesai.
-- Jalankan SELECT pertama untuk review. Bagian DELETE sengaja dikomentari agar cleanup
-- dilakukan eksplisit setelah hasil audit disetujui.

WITH latest_gantt AS (
    SELECT DISTINCT ON (g.id_toko)
        g.id_toko,
        g.id AS gantt_id
    FROM gantt_chart g
    ORDER BY g.id_toko, g.id DESC
),
completion AS (
    SELECT
        lg.id_toko,
        lg.gantt_id,
        COUNT(pg.id)::int AS total_checkpoints,
        COUNT(pg.id) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM pengawasan p
                WHERE p.id_pengawasan_gantt = pg.id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM pengawasan p
                WHERE p.id_pengawasan_gantt = pg.id
                  AND LOWER(COALESCE(p.status, '')) <> 'selesai'
            )
        )::int AS filled_checkpoints,
        COUNT(pg.id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1
                FROM pengawasan p
                WHERE p.id_pengawasan_gantt = pg.id
            )
               OR EXISTS (
                SELECT 1
                FROM pengawasan p
                WHERE p.id_pengawasan_gantt = pg.id
                  AND LOWER(COALESCE(p.status, '')) <> 'selesai'
            )
        )::int AS missing_checkpoints
    FROM latest_gantt lg
    LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = lg.gantt_id
    GROUP BY lg.id_toko, lg.gantt_id
),
latest_opname AS (
    SELECT DISTINCT ON (ofn.id_toko)
        ofn.id_toko,
        ofn.id AS opname_final_id,
        ofn.status_opname_final,
        ofn.aksi
    FROM opname_final ofn
    ORDER BY ofn.id_toko, ofn.id DESC
),
premature AS (
    SELECT
        bst.id AS berkas_serah_terima_id,
        bst.id_toko,
        t.nomor_ulok,
        t.lingkup_pekerjaan,
        t.nama_toko,
        t.cabang,
        lo.opname_final_id,
        lo.aksi,
        lo.status_opname_final,
        c.total_checkpoints,
        c.filled_checkpoints,
        c.missing_checkpoints,
        bst.link_pdf,
        bst.created_at
    FROM berkas_serah_terima bst
    JOIN toko t ON t.id = bst.id_toko
    LEFT JOIN latest_opname lo ON lo.id_toko = bst.id_toko
    LEFT JOIN completion c ON c.id_toko = bst.id_toko
    WHERE bst.link_pdf IS NOT NULL
      AND (
          lo.opname_final_id IS NULL
          OR COALESCE(c.total_checkpoints, 0) = 0
          OR COALESCE(c.missing_checkpoints, 0) > 0
      )
)
SELECT *
FROM premature
ORDER BY created_at DESC, berkas_serah_terima_id DESC;

-- Cleanup opsional setelah audit disetujui:
--
-- BEGIN;
--
-- CREATE TABLE IF NOT EXISTS serah_terima_premature_cleanup_audit (
--     audit_id SERIAL PRIMARY KEY,
--     berkas_serah_terima_id INT NOT NULL,
--     id_toko INT NOT NULL,
--     nomor_ulok TEXT,
--     lingkup_pekerjaan TEXT,
--     nama_toko TEXT,
--     cabang TEXT,
--     opname_final_id INT,
--     aksi TEXT,
--     status_opname_final TEXT,
--     total_checkpoints INT,
--     filled_checkpoints INT,
--     missing_checkpoints INT,
--     link_pdf TEXT,
--     original_created_at TIMESTAMP,
--     audited_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
-- );
--
-- WITH latest_gantt AS (
--     SELECT DISTINCT ON (g.id_toko) g.id_toko, g.id AS gantt_id
--     FROM gantt_chart g
--     ORDER BY g.id_toko, g.id DESC
-- ),
-- completion AS (
--     SELECT
--         lg.id_toko,
--         COUNT(pg.id)::int AS total_checkpoints,
--         COUNT(pg.id) FILTER (
--             WHERE EXISTS (SELECT 1 FROM pengawasan p WHERE p.id_pengawasan_gantt = pg.id)
--               AND NOT EXISTS (
--                   SELECT 1
--                   FROM pengawasan p
--                   WHERE p.id_pengawasan_gantt = pg.id
--                     AND LOWER(COALESCE(p.status, '')) <> 'selesai'
--               )
--         )::int AS filled_checkpoints,
--         COUNT(pg.id) FILTER (
--             WHERE NOT EXISTS (SELECT 1 FROM pengawasan p WHERE p.id_pengawasan_gantt = pg.id)
--                OR EXISTS (
--                   SELECT 1
--                   FROM pengawasan p
--                   WHERE p.id_pengawasan_gantt = pg.id
--                     AND LOWER(COALESCE(p.status, '')) <> 'selesai'
--               )
--         )::int AS missing_checkpoints
--     FROM latest_gantt lg
--     LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = lg.gantt_id
--     GROUP BY lg.id_toko
-- ),
-- latest_opname AS (
--     SELECT DISTINCT ON (ofn.id_toko)
--         ofn.id_toko, ofn.id AS opname_final_id, ofn.status_opname_final, ofn.aksi
--     FROM opname_final ofn
--     ORDER BY ofn.id_toko, ofn.id DESC
-- ),
-- premature AS (
--     SELECT
--         bst.id AS berkas_serah_terima_id,
--         bst.id_toko,
--         t.nomor_ulok,
--         t.lingkup_pekerjaan,
--         t.nama_toko,
--         t.cabang,
--         lo.opname_final_id,
--         lo.aksi,
--         lo.status_opname_final,
--         c.total_checkpoints,
--         c.filled_checkpoints,
--         c.missing_checkpoints,
--         bst.link_pdf,
--         bst.created_at
--     FROM berkas_serah_terima bst
--     JOIN toko t ON t.id = bst.id_toko
--     LEFT JOIN latest_opname lo ON lo.id_toko = bst.id_toko
--     LEFT JOIN completion c ON c.id_toko = bst.id_toko
--     WHERE bst.link_pdf IS NOT NULL
--       AND (
--           lo.opname_final_id IS NULL
--           OR COALESCE(c.total_checkpoints, 0) = 0
--           OR COALESCE(c.missing_checkpoints, 0) > 0
--       )
-- )
-- INSERT INTO serah_terima_premature_cleanup_audit (
--     berkas_serah_terima_id, id_toko, nomor_ulok, lingkup_pekerjaan, nama_toko,
--     cabang, opname_final_id, aksi, status_opname_final, total_checkpoints,
--     filled_checkpoints, missing_checkpoints, link_pdf, original_created_at
-- )
-- SELECT
--     berkas_serah_terima_id, id_toko, nomor_ulok, lingkup_pekerjaan, nama_toko,
--     cabang, opname_final_id, aksi, status_opname_final, total_checkpoints,
--     filled_checkpoints, missing_checkpoints, link_pdf, created_at
-- FROM premature;
--
-- DELETE FROM berkas_serah_terima bst
-- USING serah_terima_premature_cleanup_audit audit
-- WHERE audit.berkas_serah_terima_id = bst.id;
--
-- COMMIT;
