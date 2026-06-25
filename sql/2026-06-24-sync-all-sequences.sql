-- =========================================================================
-- UTILITY SCRIPT: Sync All Table Sequences
-- =========================================================================
-- Gunakan script ini jika terjadi error duplicate primary key (Unique Constraint Violation: 23505) 
-- padahal data sebenarnya baru. Error ini biasanya terjadi setelah melakukan import data manual 
-- atau restore database tanpa melakukan update pada nilai sequence (auto-increment).

SELECT setval('rab_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM rab), 1));
SELECT setval('rab_item_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM rab_item), 1));
SELECT setval('toko_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM toko), 1));
SELECT setval('gantt_chart_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM gantt_chart), 1));
SELECT setval('kategori_pekerjaan_gantt_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM kategori_pekerjaan_gantt), 1));
SELECT setval('day_gantt_chart_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM day_gantt_chart), 1));
SELECT setval('pengawasan_gantt_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM pengawasan_gantt), 1));
SELECT setval('pengawasan_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM pengawasan), 1));
SELECT setval('berkas_pengawasan_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM berkas_pengawasan), 1));
SELECT setval('opname_final_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM opname_final), 1));
SELECT setval('opname_item_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM opname_item), 1));
SELECT setval('pengajuan_spk_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM pengajuan_spk), 1));
SELECT setval('spk_approval_log_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM spk_approval_log), 1));
