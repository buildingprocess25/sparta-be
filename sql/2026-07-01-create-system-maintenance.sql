CREATE TABLE IF NOT EXISTS system_maintenance (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false,
    title TEXT NOT NULL DEFAULT 'Sistem sedang dalam pemeliharaan',
    message TEXT NOT NULL DEFAULT 'Akses sementara dibatasi agar pembaruan dapat berjalan stabil. Silakan kembali beberapa saat lagi.',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    updated_by_email TEXT,
    updated_by_role TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT system_maintenance_singleton CHECK (id = 1)
);

INSERT INTO system_maintenance (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS system_maintenance_log (
    id BIGSERIAL PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    actor_email TEXT,
    actor_role TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);
