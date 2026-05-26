-- Initial DC Development users for testing and rollout.
-- Login password/cabang follows current SPARTA auth behavior: use "HEAD OFFICE".

INSERT INTO user_cabang (cabang, nama_lengkap, jabatan, email_sat, nama_pt)
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
ON CONFLICT (email_sat, cabang) DO UPDATE
SET nama_lengkap = EXCLUDED.nama_lengkap,
    jabatan = EXCLUDED.jabatan,
    nama_pt = EXCLUDED.nama_pt;
