-- Instruksi Lapangan approval flow update:
-- Branch Building Support creates/revises IL, Branch Building Coordinator approves,
-- and Branch Building & Maintenance Manager is the final approver.
--
-- Rows that had already passed manager approval and were waiting for contractor
-- approval are finalized because the contractor stage is no longer part of IL.

UPDATE instruksi_lapangan
SET status = 'Disetujui'
WHERE status = 'Menunggu Persetujuan Kontraktor'
  AND pemberi_persetujuan_manager IS NOT NULL;

