BEGIN;

CREATE SCHEMA IF NOT EXISTS sparta_audit;

CREATE TABLE IF NOT EXISTS sparta_audit.cleanup_wrong_scope_pengawasan_20260824 (
    backup_at timestamptz NOT NULL DEFAULT now(),
    reason text NOT NULL,
    table_name text NOT NULL,
    pk text NOT NULL,
    row_data jsonb NOT NULL
);

WITH target_rows AS (
    SELECT
        p.id,
        p.id_pengawasan_gantt AS source_pengawasan_gantt_id,
        pg.tanggal_pengawasan,
        pg.id_pic_pengawasan,
        t.nomor_ulok,
        me_g.id AS me_gantt_id,
        EXISTS (
            SELECT 1
            FROM pengawasan_gantt me_pg
            JOIN pengawasan me_p ON me_p.id_pengawasan_gantt = me_pg.id
            WHERE me_pg.id_gantt = me_g.id
              AND me_pg.tanggal_pengawasan = pg.tanggal_pengawasan
              AND UPPER(TRIM(COALESCE(me_p.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
              AND UPPER(TRIM(COALESCE(me_p.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
        ) AS duplicate_in_me
    FROM toko t
    JOIN gantt_chart g ON g.id_toko = t.id
    JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
    JOIN pengawasan p ON p.id_pengawasan_gantt = pg.id
    LEFT JOIN toko me_t ON me_t.nomor_ulok = t.nomor_ulok
        AND UPPER(TRIM(COALESCE(me_t.lingkup_pekerjaan, ''))) = 'ME'
    LEFT JOIN LATERAL (
        SELECT id
        FROM gantt_chart
        WHERE id_toko = me_t.id
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id DESC
        LIMIT 1
    ) me_g ON true
    WHERE t.nomor_ulok IN (
        '2SZ1-2601-0005',
        'UZ01-2605-0030',
        'YZ01-2605-0009',
        '1DZ1-2608-1DBC-R',
        '2DZ1-2605-0001',
        '1YZ1-2606-1YW3-R',
        '2SZ1-2601-0006',
        '2SZ1-2603-0006'
    )
      AND UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = 'SIPIL'
      AND NOT EXISTS (
          SELECT 1
          FROM toko ts
          JOIN berkas_serah_terima bst ON bst.id_toko = ts.id
          WHERE ts.nomor_ulok = t.nomor_ulok
      )
      AND (
          EXISTS (
              SELECT 1
              FROM toko mt
              JOIN rab mr ON mr.id_toko = mt.id
              JOIN rab_item mri ON mri.id_rab = mr.id
              WHERE mt.nomor_ulok = t.nomor_ulok
                AND UPPER(TRIM(COALESCE(mt.lingkup_pekerjaan, ''))) = 'ME'
                AND UPPER(TRIM(COALESCE(mri.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(mri.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
          OR EXISTS (
              SELECT 1
              FROM toko mt
              JOIN opname_item oi ON oi.id_toko = mt.id
              LEFT JOIN rab_item mri ON mri.id = oi.id_rab_item
              LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
              WHERE mt.nomor_ulok = t.nomor_ulok
                AND UPPER(TRIM(COALESCE(mt.lingkup_pekerjaan, ''))) = 'ME'
                AND UPPER(TRIM(COALESCE(mri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(mri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
      )
      AND (
          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) IN ('INSTALASI', 'FIXTURE', 'PEKERJAAN SBO', 'SBO')
          OR NOT EXISTS (
              SELECT 1
              FROM rab r
              JOIN rab_item ri ON ri.id_rab = r.id
              WHERE r.id_toko = t.id
                AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
      )
),
backup_pengawasan AS (
    INSERT INTO sparta_audit.cleanup_wrong_scope_pengawasan_20260824(reason, table_name, pk, row_data)
    SELECT
        'wrong-scope SIPIL pengawasan item matched to ME; cleanup/move before ST',
        'pengawasan',
        p.id::text,
        to_jsonb(p)
    FROM pengawasan p
    JOIN target_rows tr ON tr.id = p.id
    RETURNING 1
),
backup_pengawasan_gantt AS (
    INSERT INTO sparta_audit.cleanup_wrong_scope_pengawasan_20260824(reason, table_name, pk, row_data)
    SELECT DISTINCT
        'source SIPIL checkpoint context for wrong-scope cleanup',
        'pengawasan_gantt',
        pg.id::text,
        to_jsonb(pg)
    FROM pengawasan_gantt pg
    JOIN target_rows tr ON tr.source_pengawasan_gantt_id = pg.id
    RETURNING 1
)
SELECT
    (SELECT count(*) FROM target_rows) AS target_rows,
    (SELECT count(*) FROM target_rows WHERE duplicate_in_me) AS duplicate_rows,
    (SELECT count(*) FROM target_rows WHERE NOT duplicate_in_me) AS movable_rows,
    (SELECT count(*) FROM backup_pengawasan) AS backed_up_pengawasan,
    (SELECT count(*) FROM backup_pengawasan_gantt) AS backed_up_pengawasan_gantt;

WITH target_rows AS (
    SELECT
        p.id,
        p.id_pengawasan_gantt AS source_pengawasan_gantt_id,
        pg.tanggal_pengawasan,
        pg.id_pic_pengawasan,
        t.nomor_ulok,
        me_g.id AS me_gantt_id,
        EXISTS (
            SELECT 1
            FROM pengawasan_gantt me_pg
            JOIN pengawasan me_p ON me_p.id_pengawasan_gantt = me_pg.id
            WHERE me_pg.id_gantt = me_g.id
              AND me_pg.tanggal_pengawasan = pg.tanggal_pengawasan
              AND UPPER(TRIM(COALESCE(me_p.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
              AND UPPER(TRIM(COALESCE(me_p.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
        ) AS duplicate_in_me
    FROM toko t
    JOIN gantt_chart g ON g.id_toko = t.id
    JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
    JOIN pengawasan p ON p.id_pengawasan_gantt = pg.id
    LEFT JOIN toko me_t ON me_t.nomor_ulok = t.nomor_ulok
        AND UPPER(TRIM(COALESCE(me_t.lingkup_pekerjaan, ''))) = 'ME'
    LEFT JOIN LATERAL (
        SELECT id
        FROM gantt_chart
        WHERE id_toko = me_t.id
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id DESC
        LIMIT 1
    ) me_g ON true
    WHERE t.nomor_ulok IN (
        '2SZ1-2601-0005',
        'UZ01-2605-0030',
        'YZ01-2605-0009',
        '1DZ1-2608-1DBC-R',
        '2DZ1-2605-0001',
        '1YZ1-2606-1YW3-R',
        '2SZ1-2601-0006',
        '2SZ1-2603-0006'
    )
      AND UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = 'SIPIL'
      AND NOT EXISTS (
          SELECT 1
          FROM toko ts
          JOIN berkas_serah_terima bst ON bst.id_toko = ts.id
          WHERE ts.nomor_ulok = t.nomor_ulok
      )
      AND (
          EXISTS (
              SELECT 1
              FROM toko mt
              JOIN rab mr ON mr.id_toko = mt.id
              JOIN rab_item mri ON mri.id_rab = mr.id
              WHERE mt.nomor_ulok = t.nomor_ulok
                AND UPPER(TRIM(COALESCE(mt.lingkup_pekerjaan, ''))) = 'ME'
                AND UPPER(TRIM(COALESCE(mri.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(mri.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
          OR EXISTS (
              SELECT 1
              FROM toko mt
              JOIN opname_item oi ON oi.id_toko = mt.id
              LEFT JOIN rab_item mri ON mri.id = oi.id_rab_item
              LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
              WHERE mt.nomor_ulok = t.nomor_ulok
                AND UPPER(TRIM(COALESCE(mt.lingkup_pekerjaan, ''))) = 'ME'
                AND UPPER(TRIM(COALESCE(mri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(mri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
      )
      AND (
          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) IN ('INSTALASI', 'FIXTURE', 'PEKERJAAN SBO', 'SBO')
          OR NOT EXISTS (
              SELECT 1
              FROM rab r
              JOIN rab_item ri ON ri.id_rab = r.id
              WHERE r.id_toko = t.id
                AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
          )
      )
),
inserted_me_checkpoints AS (
    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan, id_pic_pengawasan)
    SELECT DISTINCT tr.me_gantt_id, tr.tanggal_pengawasan, max(tr.id_pic_pengawasan)
    FROM target_rows tr
    WHERE NOT tr.duplicate_in_me
      AND tr.me_gantt_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM pengawasan_gantt existing
          WHERE existing.id_gantt = tr.me_gantt_id
            AND existing.tanggal_pengawasan = tr.tanggal_pengawasan
      )
    GROUP BY tr.me_gantt_id, tr.tanggal_pengawasan
    RETURNING id
),
deleted_duplicates AS (
    DELETE FROM pengawasan p
    USING target_rows tr
    WHERE tr.id = p.id
      AND tr.duplicate_in_me
    RETURNING p.id
),
moved_rows AS (
    UPDATE pengawasan p
    SET
        id_gantt = tr.me_gantt_id,
        id_pengawasan_gantt = me_pg.id
    FROM target_rows tr
    JOIN pengawasan_gantt me_pg
      ON me_pg.id_gantt = tr.me_gantt_id
     AND me_pg.tanggal_pengawasan = tr.tanggal_pengawasan
    WHERE tr.id = p.id
      AND NOT tr.duplicate_in_me
    RETURNING p.id
)
SELECT
    (SELECT count(*) FROM inserted_me_checkpoints) AS inserted_me_checkpoints,
    (SELECT count(*) FROM deleted_duplicates) AS deleted_duplicates,
    (SELECT count(*) FROM moved_rows) AS moved_rows;

COMMIT;
