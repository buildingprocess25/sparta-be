SELECT 'before_toko' AS source, COUNT(*) AS total
FROM public.toko
WHERE UPPER(TRIM(cabang)) = 'MALANB'
UNION ALL
SELECT 'before_penyimpanan_dokumen', COUNT(*)
FROM public.penyimpanan_dokumen
WHERE UPPER(TRIM(cabang)) = 'MALANB'
UNION ALL
SELECT 'before_penyimpanan_dokumen_toko', COUNT(*)
FROM public.penyimpanan_dokumen_toko
WHERE UPPER(TRIM(cabang)) = 'MALANB';

UPDATE public.toko
SET cabang = 'MALANG'
WHERE UPPER(TRIM(cabang)) = 'MALANB';

UPDATE public.penyimpanan_dokumen
SET cabang = 'MALANG'
WHERE UPPER(TRIM(cabang)) = 'MALANB';

UPDATE public.penyimpanan_dokumen_toko
SET cabang = 'MALANG'
WHERE UPPER(TRIM(cabang)) = 'MALANB';

SELECT 'after_toko' AS source, COUNT(*) AS total
FROM public.toko
WHERE UPPER(TRIM(cabang)) = 'MALANB'
UNION ALL
SELECT 'after_penyimpanan_dokumen', COUNT(*)
FROM public.penyimpanan_dokumen
WHERE UPPER(TRIM(cabang)) = 'MALANB'
UNION ALL
SELECT 'after_penyimpanan_dokumen_toko', COUNT(*)
FROM public.penyimpanan_dokumen_toko
WHERE UPPER(TRIM(cabang)) = 'MALANB';
