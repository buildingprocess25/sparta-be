-- ============================================================
-- Migration: 2026-06-05-drop-old-gantt-note-column.sql
-- Description:
--   Hapus catatan Gantt lama dari header gantt_chart.
--   Catatan komunikasi mode pengawasan sekarang disimpan di gantt_chart_note.
-- ============================================================

ALTER TABLE IF EXISTS gantt_chart
    DROP COLUMN IF EXISTS catatan_gantt;
