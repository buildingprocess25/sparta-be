-- Check cabang untuk toko yang muncul di screenshot
SELECT 
    t.id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    t.proyek,
    g.id AS gantt_id,
    g.status AS gantt_status,
    COUNT(p.id) AS total_pengawasan
FROM toko t
LEFT JOIN gantt_chart g ON g.id_toko = t.id
LEFT JOIN pengawasan p ON p.id_gantt = g.id
WHERE t.nomor_ulok IN (
    'Z001-2512-0967',
    'Z001-2512-0123', 
    'XZ01-2512-0123',
    'WZ01-2602-0022',
    'WZ01-2602-0007',
    'Z001-2511-0001'
)
GROUP BY t.id, t.nomor_ulok, t.nama_toko, t.cabang, t.proyek, g.id, g.status
ORDER BY t.nomor_ulok;

-- Summary: Berapa toko dengan cabang LUWU?
SELECT 
    cabang,
    COUNT(*) AS total_toko,
    COUNT(DISTINCT LEFT(nomor_ulok, 4)) AS total_prefix
FROM toko
WHERE UPPER(TRIM(cabang)) = 'LUWU'
GROUP BY cabang;

-- Check: Apa saja prefix yang ada di cabang LUWU?
SELECT 
    LEFT(nomor_ulok, 4) AS prefix,
    COUNT(*) AS total
FROM toko
WHERE UPPER(TRIM(cabang)) = 'LUWU'
GROUP BY LEFT(nomor_ulok, 4)
ORDER BY total DESC
LIMIT 20;
