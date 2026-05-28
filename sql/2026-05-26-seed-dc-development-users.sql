-- Initial DC Development users for testing and rollout.
-- Login password/cabang follows current SPARTA auth behavior: use "HEAD OFFICE".
--
-- This script intentionally avoids ON CONFLICT because some existing databases
-- already have user_cabang but do not have UNIQUE(email_sat, cabang).

WITH seed_users (cabang, nama_lengkap, jabatan, email_sat, nama_pt) AS (
    VALUES
        ('HEAD OFFICE', 'DC Development Specialist', 'DC BUILDING & DEVELOPMENT SPECIALIST', 'dc.specialist@alfamart.co.id', 'ALFAMART'),
        ('HEAD OFFICE', 'DC Development Manager', 'DC BUILDING & DEVELOPMENT MANAGER', 'dc.manager@alfamart.co.id', 'ALFAMART'),
        ('HEAD OFFICE', 'Building Development General Manager', 'BUILDING & DEVELOPMENT GENERAL MANAGER', 'bd.gm@alfamart.co.id', 'ALFAMART'),
        ('HEAD OFFICE', 'Location Development General Manager', 'LOCATION & DEVELOPMENT GENERAL MANAGER', 'ld.gm@alfamart.co.id', 'ALFAMART'),
        ('HEAD OFFICE', 'Property Development Director', 'PROPERTY DEVELOPMENT DIRECTOR', 'property.director@alfamart.co.id', 'ALFAMART'),
        ('HEAD OFFICE', 'Konsultan Soil Investigation Demo', 'KONSULTAN SOIL INVESTIGATION', 'vendor.soil@alfamart.co.id', 'DEMO SOIL CONSULTANT'),
        ('HEAD OFFICE', 'Konsultan Perencana Demo', 'KONSULTAN PERENCANA', 'vendor.perencana@alfamart.co.id', 'DEMO PLANNER CONSULTANT'),
        ('HEAD OFFICE', 'Konsultan Pengawas MK Demo', 'KONSULTAN PENGAWAS DC', 'vendor.mk@alfamart.co.id', 'DEMO MK CONSULTANT'),
        ('HEAD OFFICE', 'Kontraktor DC Demo', 'KONTRAKTOR DC', 'vendor.kontraktor.dc@alfamart.co.id', 'DEMO DC CONTRACTOR')
),
updated AS (
    UPDATE user_cabang u
    SET nama_lengkap = s.nama_lengkap,
        jabatan = s.jabatan,
        nama_pt = s.nama_pt
    FROM seed_users s
    WHERE LOWER(u.email_sat) = LOWER(s.email_sat)
      AND LOWER(u.cabang) = LOWER(s.cabang)
    RETURNING u.email_sat, u.cabang
)
INSERT INTO user_cabang (cabang, nama_lengkap, jabatan, email_sat, nama_pt)
SELECT s.cabang, s.nama_lengkap, s.jabatan, s.email_sat, s.nama_pt
FROM seed_users s
WHERE NOT EXISTS (
    SELECT 1
    FROM updated u
    WHERE LOWER(u.email_sat) = LOWER(s.email_sat)
      AND LOWER(u.cabang) = LOWER(s.cabang)
)
AND NOT EXISTS (
    SELECT 1
    FROM user_cabang existing
    WHERE LOWER(existing.email_sat) = LOWER(s.email_sat)
      AND LOWER(existing.cabang) = LOWER(s.cabang)
);
