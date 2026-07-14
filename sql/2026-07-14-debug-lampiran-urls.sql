-- ============================================================================
-- Debug Script: Analisis Lampiran URLs di Surat Peringatan
-- ============================================================================
-- Purpose: Memeriksa format URL lampiran dan mencari potential issues
-- Date: 2026-07-14
-- ============================================================================

-- 1. Get sample lampiran URLs (untuk testing endpoint proxy-file)
SELECT 
    id,
    spk_id,
    action_type,
    status,
    lampiran_1_url,
    CASE 
        WHEN lampiran_1_url LIKE '%drive.google.com/file/d/%' THEN 'Standard URL'
        WHEN lampiran_1_url LIKE '%drive.google.com/open?id=%' THEN 'Open URL'
        WHEN lampiran_1_url LIKE '%id=%' THEN 'Query Param URL'
        ELSE 'Unknown Format'
    END as url_format,
    LENGTH(lampiran_1_url) as url_length
FROM denda_keterlambatan_action
WHERE lampiran_1_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 2. Count total SP with lampiran
SELECT 
    COUNT(*) as total_with_lampiran,
    COUNT(DISTINCT spk_id) as unique_spk,
    action_type,
    status
FROM denda_keterlambatan_action
WHERE lampiran_1_url IS NOT NULL
GROUP BY action_type, status
ORDER BY action_type, status;

-- 3. Check for malformed URLs
SELECT 
    id,
    spk_id,
    lampiran_1_url,
    CASE 
        WHEN lampiran_1_url NOT LIKE '%drive.google.com%' THEN '❌ Not Google Drive URL'
        WHEN lampiran_1_url LIKE '%/file/d/%' AND lampiran_1_url NOT LIKE '%/view%' THEN '⚠️  Missing /view suffix'
        WHEN LENGTH(lampiran_1_url) < 50 THEN '⚠️  URL too short'
        WHEN LENGTH(lampiran_1_url) > 500 THEN '⚠️  URL too long'
        ELSE '✅ Looks OK'
    END as url_status
FROM denda_keterlambatan_action
WHERE lampiran_1_url IS NOT NULL
AND (
    lampiran_1_url NOT LIKE '%drive.google.com%'
    OR LENGTH(lampiran_1_url) < 50
    OR LENGTH(lampiran_1_url) > 500
);

-- 4. Extract file IDs from URLs (untuk manual testing)
SELECT 
    id,
    spk_id,
    lampiran_1_url,
    CASE 
        WHEN lampiran_1_url LIKE '%/file/d/%' THEN 
            SUBSTRING(lampiran_1_url FROM '/file/d/([^/]+)')
        WHEN lampiran_1_url LIKE '%open?id=%' THEN 
            SUBSTRING(lampiran_1_url FROM 'id=([^&]+)')
        ELSE NULL
    END as extracted_file_id
FROM denda_keterlambatan_action
WHERE lampiran_1_url IS NOT NULL
LIMIT 5;

-- 5. Recent SP yang bisa digunakan untuk testing
SELECT 
    da.id,
    da.spk_id,
    s.nama_toko,
    s.kode_toko,
    da.action_type,
    da.status,
    da.lampiran_1_url,
    da.created_at,
    da.created_by_name
FROM denda_keterlambatan_action da
JOIN spk s ON da.spk_id = s.id
WHERE da.lampiran_1_url IS NOT NULL
AND da.status != 'REJECTED_BY_MANAGER'
ORDER BY da.created_at DESC
LIMIT 5;

-- 6. Check for duplicate file IDs (same file used multiple times)
WITH file_ids AS (
    SELECT 
        id,
        spk_id,
        CASE 
            WHEN lampiran_1_url LIKE '%/file/d/%' THEN 
                SUBSTRING(lampiran_1_url FROM '/file/d/([^/]+)')
            WHEN lampiran_1_url LIKE '%open?id=%' THEN 
                SUBSTRING(lampiran_1_url FROM 'id=([^&]+)')
            ELSE NULL
        END as file_id
    FROM denda_keterlambatan_action
    WHERE lampiran_1_url IS NOT NULL
)
SELECT 
    file_id,
    COUNT(*) as usage_count,
    ARRAY_AGG(id ORDER BY id) as action_ids,
    ARRAY_AGG(spk_id ORDER BY id) as spk_ids
FROM file_ids
WHERE file_id IS NOT NULL
GROUP BY file_id
HAVING COUNT(*) > 1
ORDER BY usage_count DESC;

-- ============================================================================
-- TESTING COMMANDS
-- ============================================================================
-- After running query 1 or 5, copy a lampiran_1_url and test:
--
-- METHOD 1: Using curl
-- curl "http://localhost:8082/api/denda/actions/proxy-file?url=YOUR_URL_HERE"
--
-- METHOD 2: Using node script
-- Update test-proxy-file.js with URL and run: node test-proxy-file.js
--
-- METHOD 3: Browser
-- Open: http://localhost:8082/api/denda/actions/proxy-file?url=ENCODED_URL
-- ============================================================================
