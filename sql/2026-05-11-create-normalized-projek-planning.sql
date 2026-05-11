-- 0. Hapus tabel lama jika sudah ada (agar bisa di-run berulang kali tanpa error)
DROP TABLE IF EXISTS projek_planning_fasilitas CASCADE;
DROP TABLE IF EXISTS projek_planning_catatan CASCADE;
DROP TABLE IF EXISTS projek_planning_ketentuan CASCADE;
DROP TABLE IF EXISTS projek_planning_log CASCADE;
DROP TABLE IF EXISTS projek_planning CASCADE;

-- 1. Table Utama Projek Planning (Normalized - Tanpa kolom fasilitas, catatan, & ketentuan)
CREATE TABLE projek_planning (
    id SERIAL PRIMARY KEY,
    id_toko INTEGER NOT NULL,
    nomor_ulok VARCHAR(100) NOT NULL,
    email_pembuat VARCHAR(255) NOT NULL,
    
    nama_toko VARCHAR(255),
    kode_toko VARCHAR(50),
    cabang VARCHAR(100),
    proyek VARCHAR(255),
    lingkup_pekerjaan VARCHAR(100),
    jenis_proyek VARCHAR(100),
    estimasi_biaya DECIMAL(15,2),
    keterangan TEXT,
    
    -- Identitas Pengajuan
    nama_pengaju VARCHAR(255),
    nama_lokasi VARCHAR(255),
    
    -- Jenis Pengajuan
    jenis_pengajuan VARCHAR(100),
    jenis_pengajuan_lainnya VARCHAR(255),
    
    -- Link Dokumen Pendukung
    link_fpd TEXT,
    link_rab TEXT,
    link_gambar_kerja TEXT,
    link_desain_3d TEXT,
    link_fpd_approved TEXT,
    link_gambar_rab_sipil TEXT,
    link_gambar_rab_me TEXT,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    butuh_desain_3d BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Logika Approval
    bm_approver_email VARCHAR(255),
    bm_waktu_persetujuan TIMESTAMP,
    bm_alasan_penolakan TEXT,
    
    pp1_approver_email VARCHAR(255),
    pp1_waktu_persetujuan TIMESTAMP,
    pp1_alasan_penolakan TEXT,
    
    pp_manager_approver_email VARCHAR(255),
    pp_manager_waktu_persetujuan TIMESTAMP,
    pp_manager_alasan_penolakan TEXT,
    
    pp2_approver_email VARCHAR(255),
    pp2_waktu_persetujuan TIMESTAMP,
    pp2_alasan_penolakan TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Log Audit History
CREATE TABLE projek_planning_log (
    id SERIAL PRIMARY KEY,
    projek_planning_id INTEGER NOT NULL REFERENCES projek_planning(id) ON DELETE CASCADE,
    actor_email VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    aksi VARCHAR(50) NOT NULL,
    status_sebelum VARCHAR(50),
    status_sesudah VARCHAR(50) NOT NULL,
    alasan_penolakan TEXT,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Ketentuan
CREATE TABLE projek_planning_ketentuan (
    id SERIAL PRIMARY KEY,
    projek_planning_id INTEGER NOT NULL REFERENCES projek_planning(id) ON DELETE CASCADE,
    isi_ketentuan TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table Catatan Design
CREATE TABLE projek_planning_catatan (
    id SERIAL PRIMARY KEY,
    projek_planning_id INTEGER NOT NULL REFERENCES projek_planning(id) ON DELETE CASCADE,
    isi_catatan TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table Fasilitas
CREATE TABLE projek_planning_fasilitas (
    id SERIAL PRIMARY KEY,
    projek_planning_id INTEGER NOT NULL REFERENCES projek_planning(id) ON DELETE CASCADE,
    jenis_fasilitas VARCHAR(100) NOT NULL,
    nama_fasilitas_lainnya VARCHAR(255),
    is_tersedia BOOLEAN NOT NULL DEFAULT FALSE,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
