-- ============================================================
-- MIGRATION: Project Planning Tables
-- Date: 2026-05-08
-- Description: Menambahkan tabel projek_planning dan projek_planning_log
--              untuk mendukung fitur Project Planning dengan alur approval:
--              Coordinator → BM → PP Specialist (1) → [3D] → PP Manager → PP Specialist (2)
-- ============================================================

-- 1) PROJEK_PLANNING (Header)
CREATE TABLE IF NOT EXISTS projek_planning (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL,
    nomor_ulok VARCHAR(255) NOT NULL,
    email_pembuat VARCHAR(255) NOT NULL,

    -- Data toko snapshot
    nama_toko VARCHAR(255),
    kode_toko VARCHAR(255),
    cabang VARCHAR(255),
    proyek VARCHAR(255),
    lingkup_pekerjaan VARCHAR(255),

    -- Data FPD (Form Pengajuan Data)
    jenis_proyek VARCHAR(255),
    estimasi_biaya NUMERIC(18,2),
    keterangan TEXT,

    -- File attachments
    link_fpd VARCHAR(500),
    link_rab VARCHAR(500),
    link_gambar_kerja VARCHAR(500),
    link_desain_3d VARCHAR(500),
    link_fpd_approved VARCHAR(500),

    -- Status & flags
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    butuh_desain_3d BOOLEAN NOT NULL DEFAULT FALSE,

    -- BM Approval
    bm_approver_email VARCHAR(255),
    bm_waktu_persetujuan TIMESTAMPTZ,
    bm_alasan_penolakan TEXT,

    -- PP Specialist Approval (Stage 1)
    pp1_approver_email VARCHAR(255),
    pp1_waktu_persetujuan TIMESTAMPTZ,
    pp1_alasan_penolakan TEXT,

    -- PP Manager Approval
    pp_manager_approver_email VARCHAR(255),
    pp_manager_waktu_persetujuan TIMESTAMPTZ,
    pp_manager_alasan_penolakan TEXT,

    -- PP Specialist Approval (Stage 2 / Final)
    pp2_approver_email VARCHAR(255),
    pp2_waktu_persetujuan TIMESTAMPTZ,
    pp2_alasan_penolakan TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projek_planning_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE,
    CONSTRAINT chk_projek_planning_status CHECK (status IN (
        'DRAFT',
        'WAITING_BM_APPROVAL',
        'WAITING_PP_APPROVAL_1',
        'PP_DESIGN_3D_REQUIRED',
        'WAITING_RAB_UPLOAD',
        'WAITING_PP_MANAGER_APPROVAL',
        'WAITING_PP_APPROVAL_2',
        'COMPLETED',
        'REJECTED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_projek_planning_id_toko ON projek_planning(id_toko);
CREATE INDEX IF NOT EXISTS idx_projek_planning_status ON projek_planning(status);
CREATE INDEX IF NOT EXISTS idx_projek_planning_nomor_ulok ON projek_planning(nomor_ulok);
CREATE INDEX IF NOT EXISTS idx_projek_planning_email_pembuat ON projek_planning(email_pembuat);
CREATE INDEX IF NOT EXISTS idx_projek_planning_cabang ON projek_planning(cabang);
CREATE INDEX IF NOT EXISTS idx_projek_planning_created_at ON projek_planning(created_at);

-- 2) PROJEK_PLANNING_LOG (Audit Trail)
CREATE TABLE IF NOT EXISTS projek_planning_log (
    id SERIAL PRIMARY KEY,
    projek_planning_id INT NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    aksi VARCHAR(50) NOT NULL,
    status_sebelum VARCHAR(50),
    status_sesudah VARCHAR(50),
    alasan_penolakan TEXT,
    keterangan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projek_planning_log_header FOREIGN KEY (projek_planning_id)
        REFERENCES projek_planning(id) ON DELETE CASCADE,
    CONSTRAINT chk_projek_planning_log_aksi CHECK (aksi IN (
        'SUBMIT', 'APPROVE', 'REJECT', 'UPLOAD_3D', 'UPLOAD_RAB', 'COMPLETE'
    )),
    CONSTRAINT chk_projek_planning_log_role CHECK (role IN (
        'COORDINATOR', 'BM', 'PP_SPECIALIST', 'PP_MANAGER'
    ))
);

CREATE INDEX IF NOT EXISTS idx_projek_planning_log_header ON projek_planning_log(projek_planning_id);
CREATE INDEX IF NOT EXISTS idx_projek_planning_log_actor ON projek_planning_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_projek_planning_log_created_at ON projek_planning_log(created_at);
