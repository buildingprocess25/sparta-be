-- ============================================================================
-- Migration: System Access Schedule
-- ============================================================================
-- Tabel konfigurasi jadwal akses aplikasi SPARTA Building.
-- Singleton table: hanya boleh ada 1 record dengan id = 1.
--
-- Kolom menit menggunakan integer 0-1440 untuk menghindari ambiguitas TIME '24:00'.
-- - 0 = 00:00
-- - 360 = 06:00
-- - 1440 = 24:00 (tengah malam)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_access_schedule (
    id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- Kontrol utama: apakah jadwal akses diaktifkan?
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Hari kerja dan akhir pekan
    weekday_enabled BOOLEAN NOT NULL DEFAULT true,
    weekend_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Jam akses untuk user umum (dalam menit dari 00:00)
    general_start_minutes INTEGER NOT NULL DEFAULT 360 CHECK (general_start_minutes >= 0 AND general_start_minutes <= 1440),
    general_end_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (general_end_minutes >= 0 AND general_end_minutes <= 1440),
    
    -- Jam akses untuk kontraktor (dalam menit dari 00:00)
    contractor_start_minutes INTEGER NOT NULL DEFAULT 360 CHECK (contractor_start_minutes >= 0 AND contractor_start_minutes <= 1440),
    contractor_end_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (contractor_end_minutes >= 0 AND contractor_end_minutes <= 1440),
    
    -- Audit
    updated_by_email TEXT,
    updated_by_role TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    
    -- Singleton constraint: hanya boleh ada 1 record
    CONSTRAINT system_access_schedule_singleton CHECK (id = 1)
);

-- Insert default record
INSERT INTO system_access_schedule (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Tabel log perubahan jadwal akses
CREATE TABLE IF NOT EXISTS system_access_schedule_log (
    id BIGSERIAL PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL,
    weekday_enabled BOOLEAN NOT NULL,
    weekend_enabled BOOLEAN NOT NULL,
    general_start_minutes INTEGER NOT NULL,
    general_end_minutes INTEGER NOT NULL,
    contractor_start_minutes INTEGER NOT NULL,
    contractor_end_minutes INTEGER NOT NULL,
    actor_email TEXT,
    actor_role TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);
