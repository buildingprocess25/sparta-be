-- Repair RAB yang masih tertahan di "Menunggu Gantt Chart"
-- padahal Gantt Chart untuk toko tersebut sudah pernah disimpan/terkunci.

UPDATE rab r
SET status = 'Menunggu Persetujuan Direktur Kontraktor'
WHERE r.status = 'Menunggu Gantt Chart'
  AND EXISTS (
      SELECT 1
      FROM gantt_chart g
      WHERE g.id_toko = r.id_toko
        AND LOWER(COALESCE(g.status, '')) IN ('active', 'terkunci')
  );

