-- Optimize KTK (Opname Final) dashboard export without changing exported content.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opname_final_ktk_export
ON opname_final (id_toko, created_at DESC, id DESC)
WHERE UPPER(COALESCE(tipe_opname, '')) = 'OPNAME_FINAL';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_berkas_serah_terima_toko_created
ON berkas_serah_terima (id_toko, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pengajuan_spk_toko_created
ON pengajuan_spk (id_toko, created_at DESC, id DESC);
