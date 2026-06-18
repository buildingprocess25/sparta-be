BEGIN;

CREATE TEMP TABLE tmp_pengawasan_gantt_dedup ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        pg.id,
        pg.id_gantt,
        pg.tanggal_pengawasan,
        FIRST_VALUE(pg.id) OVER (
            PARTITION BY pg.id_gantt, pg.tanggal_pengawasan
            ORDER BY
                (
                    EXISTS (
                        SELECT 1
                        FROM pengawasan p
                        WHERE p.id_pengawasan_gantt = pg.id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM berkas_pengawasan bp
                        WHERE bp.id_pengawasan_gantt = pg.id
                    )
                ) DESC,
                pg.id ASC
        ) AS keep_id,
        ROW_NUMBER() OVER (
            PARTITION BY pg.id_gantt, pg.tanggal_pengawasan
            ORDER BY
                (
                    EXISTS (
                        SELECT 1
                        FROM pengawasan p
                        WHERE p.id_pengawasan_gantt = pg.id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM berkas_pengawasan bp
                        WHERE bp.id_pengawasan_gantt = pg.id
                    )
                ) DESC,
                pg.id ASC
        ) AS row_number
    FROM pengawasan_gantt pg
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE row_number > 1;

UPDATE pengawasan p
SET id_pengawasan_gantt = d.keep_id
FROM tmp_pengawasan_gantt_dedup d
WHERE p.id_pengawasan_gantt = d.duplicate_id;

INSERT INTO berkas_pengawasan (
    id_pengawasan_gantt,
    link_pdf_pengawasan,
    created_at
)
SELECT
    d.keep_id,
    (ARRAY_AGG(bp.link_pdf_pengawasan ORDER BY bp.created_at DESC, bp.id DESC)
        FILTER (WHERE bp.link_pdf_pengawasan IS NOT NULL))[1],
    MAX(bp.created_at)
FROM tmp_pengawasan_gantt_dedup d
JOIN berkas_pengawasan bp
  ON bp.id_pengawasan_gantt = d.duplicate_id
GROUP BY d.keep_id
ON CONFLICT (id_pengawasan_gantt)
DO UPDATE SET
    link_pdf_pengawasan = COALESCE(
        EXCLUDED.link_pdf_pengawasan,
        berkas_pengawasan.link_pdf_pengawasan
    ),
    created_at = GREATEST(
        EXCLUDED.created_at,
        berkas_pengawasan.created_at
    );

DELETE FROM berkas_pengawasan bp
USING tmp_pengawasan_gantt_dedup d
WHERE bp.id_pengawasan_gantt = d.duplicate_id;

DELETE FROM pengawasan_gantt pg
USING tmp_pengawasan_gantt_dedup d
WHERE pg.id = d.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pengawasan_gantt_gantt_tanggal
    ON pengawasan_gantt (id_gantt, tanggal_pengawasan);

COMMIT;
