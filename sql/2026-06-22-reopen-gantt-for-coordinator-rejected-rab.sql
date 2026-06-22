BEGIN;

WITH candidates AS (
    SELECT
        g.id AS gantt_id,
        g.id_toko,
        latest_rab.id AS rab_id,
        latest_rab.ditolak_oleh,
        latest_rab.alasan_penolakan
    FROM gantt_chart g
    JOIN LATERAL (
        SELECT r.id, r.status, r.ditolak_oleh, r.alasan_penolakan
        FROM rab r
        WHERE r.id_toko = g.id_toko
        ORDER BY r.id DESC
        LIMIT 1
    ) latest_rab ON true
    WHERE g.id = (
        SELECT latest_gantt.id
        FROM gantt_chart latest_gantt
        WHERE latest_gantt.id_toko = g.id_toko
        ORDER BY latest_gantt.id DESC
        LIMIT 1
    )
      AND LOWER(COALESCE(g.status, '')) <> 'active'
      AND latest_rab.status = 'Ditolak oleh Koordinator'
),
audit_insert AS (
    INSERT INTO activity_log (
        entity_type,
        entity_id,
        actor_email,
        actor_role,
        action,
        status_before,
        status_after,
        reason,
        metadata,
        created_at
    )
    SELECT
        'GANTT',
        candidate.gantt_id,
        candidate.ditolak_oleh,
        'KOORDINATOR',
        'RAB_REJECTED_REOPEN_GANTT',
        'terkunci',
        'active',
        candidate.alasan_penolakan,
        jsonb_build_object(
            'id_toko', candidate.id_toko,
            'id_rab', candidate.rab_id,
            'source', 'historical_repair_rab_rejected_by_coordinator'
        ),
        timezone('Asia/Jakarta', now())
    FROM candidates candidate
    WHERE NOT EXISTS (
        SELECT 1
        FROM activity_log log
        WHERE log.entity_type = 'GANTT'
          AND log.entity_id = candidate.gantt_id
          AND log.action = 'RAB_REJECTED_REOPEN_GANTT'
          AND log.status_after = 'active'
    )
    RETURNING entity_id
)
UPDATE gantt_chart gantt
SET status = 'active'
FROM candidates candidate
WHERE gantt.id = candidate.gantt_id;

COMMIT;
