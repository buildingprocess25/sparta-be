-- ============================================================
-- Migration: 2026-06-05-create-gantt-chart-note.sql
-- Description:
--   Catatan komunikasi/chat pada mode pengawasan Gantt Chart.
--   Catatan ini historis, banyak baris, dan perlu menyimpan identitas pengirim.
-- ============================================================

CREATE TABLE IF NOT EXISTS gantt_chart_note (
    id SERIAL PRIMARY KEY,
    id_gantt INT NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(255) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_gantt_chart_note_gantt
        FOREIGN KEY (id_gantt) REFERENCES gantt_chart(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gantt_chart_note_gantt_created
ON gantt_chart_note (id_gantt, created_at, id);
