-- ============================================================
-- Migration: 2026-06-04-global-approval-notes-rab-gantt-dokumentasi.sql
-- Description:
--   - Catatan approve/reject lintas modul approval.
--   - Revisi RAB per item.
--   - Catatan memo pengawasan Gantt.
--   - Dokumentasi bangunan tetap memakai tabel item; foto 39-40
--     tersimpan via item_index dan sudut_foto.
--   Aman dijalankan berulang kali di DBeaver.
-- ============================================================

-- Catatan approval RAB per role + catatan reject.
ALTER TABLE rab
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_koordinator TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_manager TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_direktur TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_penolakan TEXT DEFAULT NULL;

-- Catatan approval SPK disimpan di log, supaya setiap tindakan tetap historis.
ALTER TABLE spk_approval_log
    ADD COLUMN IF NOT EXISTS catatan_approval TEXT DEFAULT NULL;

-- Catatan approval Pertambahan SPK.
ALTER TABLE pertambahan_spk
    ADD COLUMN IF NOT EXISTS catatan_approval TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_penolakan TEXT DEFAULT NULL;

-- Catatan approval Opname Final per role + catatan reject.
ALTER TABLE opname_final
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_koordinator TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_manager TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_direktur TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_penolakan TEXT DEFAULT NULL;

-- Catatan approval Instruksi Lapangan per role + catatan reject.
ALTER TABLE instruksi_lapangan
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_koordinator TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_manager TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_persetujuan_kontraktor TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS catatan_penolakan TEXT DEFAULT NULL;

-- Revisi RAB per item. Tabel ini menyimpan target item yang diminta revisi
-- oleh approver tanpa mengubah isi rab_item asli.
CREATE TABLE IF NOT EXISTS rab_revisi_item (
    id SERIAL PRIMARY KEY,
    id_rab INT NOT NULL,
    id_rab_item INT,
    approver_email VARCHAR(255),
    approver_role VARCHAR(80),
    catatan_item TEXT,
    catatan_umum TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_rab_revisi_item_rab
        FOREIGN KEY (id_rab) REFERENCES rab(id) ON DELETE CASCADE,
    CONSTRAINT fk_rab_revisi_item_item
        FOREIGN KEY (id_rab_item) REFERENCES rab_item(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rab_revisi_item_rab ON rab_revisi_item(id_rab);
CREATE INDEX IF NOT EXISTS idx_rab_revisi_item_item ON rab_revisi_item(id_rab_item);

-- Catatan memo di jadwal pengawasan Gantt.
ALTER TABLE pengawasan_gantt
    ADD COLUMN IF NOT EXISTS catatan_memo TEXT DEFAULT NULL;

COMMENT ON COLUMN pengawasan_gantt.catatan_memo IS
'Catatan dari memo pengawasan Gantt yang ditampilkan sebagai pop up saat pengawasan berikutnya dibuka.';

-- Dokumentasi bangunan item sudah fleksibel melalui item_index.
-- Index ini membantu query foto 39-40 dan menjaga urutan render PDF.
CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_item_doc_index
    ON dokumentasi_bangunan_item(id_dokumentasi_bangunan, item_index);
