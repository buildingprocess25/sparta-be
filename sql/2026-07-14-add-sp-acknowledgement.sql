-- =====================================================================
-- Migration: Add SP Acknowledgement Support
-- Date: 2026-07-14
-- Purpose: Enable kontraktor to acknowledge received Surat Peringatan
-- =====================================================================

-- 1. Ensure all timestamp columns exist (idempotent)
ALTER TABLE denda_keterlambatan_action
  ADD COLUMN IF NOT EXISTS sent_to_contractor_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS viewed_by_contractor_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS acknowledged_by_contractor_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS acknowledged_by_email TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_by_role TEXT;

-- 2. Add index untuk query performance
CREATE INDEX IF NOT EXISTS idx_denda_action_contractor_status 
ON denda_keterlambatan_action (status, nama_kontraktor, cabang)
WHERE status IN ('SENT_TO_CONTRACTOR', 'VIEWED_BY_CONTRACTOR', 'ACKNOWLEDGED_BY_CONTRACTOR');

-- 3. Update existing APPROVED records yang belum sent
-- (Set sent_to_contractor_at = manager_approved_at jika NULL)
UPDATE denda_keterlambatan_action
SET 
  sent_to_contractor_at = manager_approved_at,
  status = CASE 
    WHEN status = 'APPROVED' AND manager_approved_at IS NOT NULL 
    THEN 'SENT_TO_CONTRACTOR'
    ELSE status
  END,
  updated_at = timezone('Asia/Jakarta', now())
WHERE action_type = 'SP'
  AND status = 'APPROVED'
  AND sent_to_contractor_at IS NULL
  AND manager_approved_at IS NOT NULL;

-- 4. Add comment untuk dokumentasi
COMMENT ON COLUMN denda_keterlambatan_action.sent_to_contractor_at IS 
  'Timestamp saat email SP dikirim ke kontraktor (auto-set after approval)';
COMMENT ON COLUMN denda_keterlambatan_action.viewed_by_contractor_at IS 
  'Timestamp saat kontraktor pertama kali membuka detail SP (auto-tracked)';
COMMENT ON COLUMN denda_keterlambatan_action.acknowledged_by_contractor_at IS 
  'Timestamp saat kontraktor menekan tombol acknowledge (manual action)';

-- 5. Verification query
SELECT 
  COUNT(*) AS total_sp,
  COUNT(*) FILTER (WHERE status = 'SENT_TO_CONTRACTOR') AS sent,
  COUNT(*) FILTER (WHERE status = 'VIEWED_BY_CONTRACTOR') AS viewed,
  COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED_BY_CONTRACTOR') AS acknowledged
FROM denda_keterlambatan_action
WHERE action_type = 'SP';
