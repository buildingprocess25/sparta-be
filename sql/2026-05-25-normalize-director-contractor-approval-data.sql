-- Normalisasi data lama agar approval direktur kontraktor konsisten.

UPDATE user_cabang
SET jabatan = 'Direktur Kontraktor'
WHERE UPPER(TRIM(jabatan)) IN ('DIREKTUR', 'DIREKTUR KONTRAKTOR', 'DIREKTUR_KONTRAKTOR');

UPDATE rab
SET status = 'Menunggu Persetujuan Direktur Kontraktor'
WHERE status = 'Menunggu Persetujuan Direktur';

UPDATE rab
SET status = 'Ditolak oleh Direktur Kontraktor'
WHERE status = 'Ditolak oleh Direktur';

UPDATE opname_final
SET status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
WHERE status_opname_final = 'Menunggu Persetujuan Direktur';

UPDATE opname_final
SET status_opname_final = 'Ditolak oleh Direktur Kontraktor'
WHERE status_opname_final = 'Ditolak oleh Direktur';
