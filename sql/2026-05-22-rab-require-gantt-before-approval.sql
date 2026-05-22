-- Alur baru RAB: RAB dibuat -> Gantt Chart dibuat -> Approval RAB.
-- Tidak ada perubahan struktur tabel; status RAB memakai kolom text yang sudah ada.

-- Rapikan data lama yang sudah telanjur masuk antrean approval tetapi belum punya Gantt.
-- Approval yang sempat tercatat ikut dibersihkan karena approval tersebut terjadi sebelum Gantt dibuat.
UPDATE rab r
SET status = 'Menunggu Gantt Chart',
    pemberi_persetujuan_direktur = NULL,
    nama_persetujuan_direktur = NULL,
    waktu_persetujuan_direktur = NULL,
    pemberi_persetujuan_koordinator = NULL,
    nama_persetujuan_koordinator = NULL,
    waktu_persetujuan_koordinator = NULL,
    pemberi_persetujuan_manager = NULL,
    nama_persetujuan_manager = NULL,
    waktu_persetujuan_manager = NULL
WHERE r.status IN (
    'Menunggu Persetujuan Direktur',
    'Menunggu Persetujuan Koordinator',
    'Menunggu Persetujuan Manajer'
)
AND NOT EXISTS (
    SELECT 1
    FROM gantt_chart g
    WHERE g.id_toko = r.id_toko
);
