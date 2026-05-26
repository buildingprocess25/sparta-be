-- Repair deadlock revisi RAB/Gantt:
-- RAB sudah kembali ke "Menunggu Gantt Chart", tetapi Gantt terbaru masih terkunci,
-- sehingga kontraktor tidak bisa merevisi jadwal untuk melanjutkan approval.

WITH latest_gantt AS (
    SELECT DISTINCT ON (g.id_toko)
        g.id,
        g.id_toko
    FROM gantt_chart g
    JOIN rab r ON r.id_toko = g.id_toko
    WHERE r.status = 'Menunggu Gantt Chart'
    ORDER BY g.id_toko, g.id DESC
)
UPDATE gantt_chart g
SET status = 'active'
FROM latest_gantt lg
WHERE g.id = lg.id
  AND LOWER(COALESCE(g.status, '')) IN ('terkunci', 'locked', 'published');
