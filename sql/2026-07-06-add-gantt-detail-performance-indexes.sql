CREATE INDEX IF NOT EXISTS idx_gantt_chart_id_toko_latest
    ON gantt_chart(id_toko, timestamp DESC NULLS LAST, id DESC);

CREATE INDEX IF NOT EXISTS idx_kategori_pekerjaan_gantt_id_gantt
    ON kategori_pekerjaan_gantt(id_gantt, id);

CREATE INDEX IF NOT EXISTS idx_day_gantt_chart_id_gantt
    ON day_gantt_chart(id_gantt, id);

CREATE INDEX IF NOT EXISTS idx_pengawasan_gantt_id_gantt
    ON pengawasan_gantt(id_gantt, id);

CREATE INDEX IF NOT EXISTS idx_dependency_gantt_id_gantt
    ON dependency_gantt(id_gantt, id);
