BEGIN;

CREATE SCHEMA IF NOT EXISTS sparta_audit;

CREATE TABLE IF NOT EXISTS sparta_audit.backfill_2sz1_2603_0006_me_carry_forward_20260824 (
    id bigserial PRIMARY KEY,
    reason text NOT NULL,
    table_name text NOT NULL,
    pk text NOT NULL,
    row_data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

WITH source_context AS (
    SELECT
        src_pg.id AS source_id_pengawasan_gantt,
        dst_pg.id AS target_id_pengawasan_gantt,
        g.id AS id_gantt
    FROM toko t
    JOIN gantt_chart g ON g.id_toko = t.id
    JOIN pengawasan_gantt src_pg
      ON src_pg.id_gantt = g.id
     AND src_pg.tanggal_pengawasan = '15/07/2026'
    JOIN pengawasan_gantt dst_pg
      ON dst_pg.id_gantt = g.id
     AND dst_pg.tanggal_pengawasan = '22/07/2026'
    WHERE t.nomor_ulok = '2SZ1-2603-0006'
      AND t.lingkup_pekerjaan = 'ME'
), source_rows AS (
    SELECT p.*
    FROM source_context ctx
    JOIN pengawasan p
      ON p.id_gantt = ctx.id_gantt
     AND p.id_pengawasan_gantt = ctx.source_id_pengawasan_gantt
    WHERE lower(trim(coalesce(p.status, ''))) = 'terlambat'
), target_rows AS (
    SELECT p.*
    FROM source_context ctx
    JOIN pengawasan p
      ON p.id_gantt = ctx.id_gantt
     AND p.id_pengawasan_gantt = ctx.target_id_pengawasan_gantt
), rows_to_insert AS (
    SELECT src.*, ctx.target_id_pengawasan_gantt
    FROM source_rows src
    CROSS JOIN source_context ctx
    WHERE NOT EXISTS (
        SELECT 1
        FROM target_rows existing
        WHERE upper(trim(coalesce(existing.kategori_pekerjaan, ''))) = upper(trim(coalesce(src.kategori_pekerjaan, '')))
          AND upper(trim(coalesce(existing.jenis_pekerjaan, ''))) = upper(trim(coalesce(src.jenis_pekerjaan, '')))
    )
), backup_source AS (
    INSERT INTO sparta_audit.backfill_2sz1_2603_0006_me_carry_forward_20260824(reason, table_name, pk, row_data)
    SELECT 'source_15_07_terlambat', 'pengawasan', id::text, to_jsonb(source_rows)
    FROM source_rows
    RETURNING 1
), backup_target AS (
    INSERT INTO sparta_audit.backfill_2sz1_2603_0006_me_carry_forward_20260824(reason, table_name, pk, row_data)
    SELECT 'existing_target_22_07_before_insert', 'pengawasan', id::text, to_jsonb(target_rows)
    FROM target_rows
    RETURNING 1
), inserted AS (
    INSERT INTO pengawasan (
        id_gantt,
        id_pengawasan_gantt,
        kategori_pekerjaan,
        jenis_pekerjaan,
        catatan,
        dokumentasi,
        dokumentasi_base64,
        status
    )
    SELECT
        id_gantt,
        target_id_pengawasan_gantt,
        kategori_pekerjaan,
        jenis_pekerjaan,
        catatan,
        NULL,
        NULL,
        'terlambat'
    FROM rows_to_insert
    RETURNING *
), backup_inserted AS (
    INSERT INTO sparta_audit.backfill_2sz1_2603_0006_me_carry_forward_20260824(reason, table_name, pk, row_data)
    SELECT 'inserted_target_22_07', 'pengawasan', id::text, to_jsonb(inserted)
    FROM inserted
    RETURNING 1
)
SELECT
    (SELECT count(*) FROM source_rows) AS source_15_07_terlambat,
    (SELECT count(*) FROM target_rows) AS existing_22_07_before_insert,
    (SELECT count(*) FROM rows_to_insert) AS planned_insert,
    (SELECT count(*) FROM inserted) AS inserted_22_07,
    (SELECT count(*) FROM backup_source) AS backed_up_source,
    (SELECT count(*) FROM backup_target) AS backed_up_target_before_insert,
    (SELECT count(*) FROM backup_inserted) AS backed_up_inserted;

COMMIT;
