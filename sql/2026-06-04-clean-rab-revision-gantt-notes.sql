-- ============================================================
-- Migration: 2026-06-04-clean-rab-revision-gantt-notes.sql
-- Description:
--   - Hilangkan catatan revisi umum RAB; revisi RAB hanya alasan penolakan
--     header + catatan per item.
--   - Pindahkan catatan umum Gantt ke header gantt_chart agar bisa dilihat
--     semua role, bukan catatan memo pengawasan.
--   Aman dijalankan berulang kali di DBeaver.
-- ============================================================

ALTER TABLE gantt_chart
    ADD COLUMN IF NOT EXISTS catatan_gantt TEXT DEFAULT NULL;

COMMENT ON COLUMN gantt_chart.catatan_gantt IS
    'Catatan umum Gantt Chart yang dapat dilihat semua role pada detail Gantt.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pengawasan_gantt'
          AND column_name = 'catatan_memo'
    ) THEN
        UPDATE gantt_chart g
        SET catatan_gantt = src.catatan_memo
        FROM (
            SELECT DISTINCT ON (id_gantt)
                id_gantt,
                catatan_memo
            FROM pengawasan_gantt
            WHERE catatan_memo IS NOT NULL
              AND BTRIM(catatan_memo) <> ''
            ORDER BY id_gantt, id DESC
        ) src
        WHERE g.id = src.id_gantt
          AND (g.catatan_gantt IS NULL OR BTRIM(g.catatan_gantt) = '');
    END IF;
END $$;

ALTER TABLE IF EXISTS pengawasan_gantt
    DROP COLUMN IF EXISTS catatan_memo;

ALTER TABLE IF EXISTS rab_revisi_item
    DROP COLUMN IF EXISTS catatan_umum;
