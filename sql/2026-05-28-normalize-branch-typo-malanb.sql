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
WHERE UPPER(TRIM(cabang)) = 'MALANB'
  AND NOT EXISTS (
      SELECT 1
      FROM public.penyimpanan_dokumen target
      WHERE UPPER(TRIM(target.cabang)) = 'MALANG'
        AND LOWER(COALESCE(target.kode_toko, '')) = LOWER(COALESCE(public.penyimpanan_dokumen.kode_toko, ''))
        AND LOWER(COALESCE(target.kategori_dokumen, '')) = LOWER(COALESCE(public.penyimpanan_dokumen.kategori_dokumen, ''))
        AND LOWER(COALESCE(target.nama_dokumen, '')) = LOWER(COALESCE(public.penyimpanan_dokumen.nama_dokumen, ''))
        AND COALESCE(target.link_dokumen, '') = COALESCE(public.penyimpanan_dokumen.link_dokumen, '')
  );

UPDATE public.penyimpanan_dokumen_toko
SET cabang = 'MALANG'
WHERE UPPER(TRIM(cabang)) = 'MALANB'
  AND NOT EXISTS (
      SELECT 1
      FROM public.penyimpanan_dokumen_toko target
      WHERE UPPER(TRIM(target.cabang)) = 'MALANG'
        AND LOWER(COALESCE(target.kode_toko, '')) = LOWER(COALESCE(public.penyimpanan_dokumen_toko.kode_toko, ''))
        AND LOWER(COALESCE(target.nama_toko, '')) = LOWER(COALESCE(public.penyimpanan_dokumen_toko.nama_toko, ''))
  );

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

SELECT
    'remaining_conflict_penyimpanan_dokumen_toko' AS source,
    id,
    kode_toko,
    nama_toko,
    cabang
FROM public.penyimpanan_dokumen_toko
WHERE UPPER(TRIM(cabang)) = 'MALANB';

SELECT
    'remaining_conflict_penyimpanan_dokumen' AS source,
    id,
    kode_toko,
    nama_toko,
    cabang,
    kategori_dokumen,
    nama_dokumen,
    link_dokumen
FROM public.penyimpanan_dokumen
WHERE UPPER(TRIM(cabang)) = 'MALANB';
