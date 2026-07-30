-- Optimize Gantt SIPIL+ME workspace loading without changing query results.
-- These indexes support existing lookup patterns in ganttRepository.findSupervisionWorkspace.
-- Run outside an explicit transaction because CREATE INDEX CONCURRENTLY cannot run in one.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rab_id_toko_latest
ON rab (id_toko, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rab_item_id_rab
ON rab_item (id_rab, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gantt_chart_id_toko_id_desc
ON gantt_chart (id_toko, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pic_pengawasan_id_toko_id_desc
ON pic_pengawasan (id_toko, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pic_pengawasan_nomor_ulok_norm_id_desc
ON pic_pengawasan ((UPPER(TRIM(COALESCE(nomor_ulok, '')))), id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pengawasan_checkpoint_work_latest
ON pengawasan (
    id_pengawasan_gantt,
    id_gantt,
    (UPPER(TRIM(COALESCE(kategori_pekerjaan, '')))),
    (UPPER(TRIM(COALESCE(jenis_pekerjaan, '')))),
    id DESC
);
