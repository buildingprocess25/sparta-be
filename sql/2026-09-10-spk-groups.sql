-- Additive only: existing SPKs remain ungrouped. Apply before deploying new BE/FE.
BEGIN;
ALTER TABLE pengajuan_spk ADD COLUMN IF NOT EXISTS spk_group_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pengajuan_spk_group_scope_unique
    ON pengajuan_spk (spk_group_id, upper(trim(lingkup_pekerjaan)))
    WHERE spk_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pengajuan_spk_group_lookup ON pengajuan_spk (spk_group_id)
    WHERE spk_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pengajuan_spk_ulok_scope_history
    ON pengajuan_spk (upper(trim(nomor_ulok)), upper(trim(lingkup_pekerjaan)), created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS rab_approved_spk_candidate
    ON rab (id_toko, created_at DESC, id DESC) WHERE status = 'Disetujui';
COMMIT;
