-- Sync hari pengawasan terakhir dengan tanggal akhir SPK efektif.
-- Tanggal akhir SPK efektif = tanggal perpanjangan SPK approved, fallback waktu_selesai SPK.
-- Insert-only: tidak menghapus tanggal pengawasan lama agar riwayat memo tetap aman.

WITH spk_effective AS (
    SELECT
        ps.nomor_ulok,
        GREATEST(
            ps.waktu_selesai::date,
            COALESCE(MAX(
                CASE
                    WHEN pt.tanggal_spk_akhir_setelah_perpanjangan ~ '^\d{4}-\d{2}-\d{2}'
                        THEN LEFT(pt.tanggal_spk_akhir_setelah_perpanjangan, 10)::date
                    WHEN pt.tanggal_spk_akhir_setelah_perpanjangan ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                        THEN to_date(pt.tanggal_spk_akhir_setelah_perpanjangan, 'DD/MM/YYYY')
                    ELSE NULL
                END
            ), ps.waktu_selesai::date)
        ) AS effective_end
    FROM pengajuan_spk ps
    LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
        AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
    WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
    GROUP BY ps.id, ps.nomor_ulok, ps.waktu_selesai
),
ulok_effective AS (
    SELECT se.nomor_ulok, MAX(se.effective_end) AS effective_end
    FROM spk_effective se
    WHERE EXISTS (
        SELECT 1
        FROM pengajuan_spk ps
        JOIN pertambahan_spk pt ON pt.id_spk = ps.id
        WHERE ps.nomor_ulok = se.nomor_ulok
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
    )
    GROUP BY se.nomor_ulok
),
target_pengawasan AS (
    SELECT
        g.id AS id_gantt,
        to_char(ue.effective_end, 'DD/MM/YYYY') AS tanggal_pengawasan
    FROM ulok_effective ue
    JOIN toko t ON t.nomor_ulok = ue.nomor_ulok
    JOIN gantt_chart g ON g.id_toko = t.id
    WHERE ue.effective_end IS NOT NULL
)
INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
SELECT tp.id_gantt, tp.tanggal_pengawasan
FROM target_pengawasan tp
WHERE NOT EXISTS (
    SELECT 1
    FROM pengawasan_gantt pg
    WHERE pg.id_gantt = tp.id_gantt
      AND pg.tanggal_pengawasan = tp.tanggal_pengawasan
);
