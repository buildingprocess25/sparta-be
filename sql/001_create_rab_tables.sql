CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS toko (
  nomor_ulok TEXT PRIMARY KEY,
  nama_toko TEXT NOT NULL,
  kode_toko TEXT NOT NULL,
  cabang TEXT NOT NULL,
  alamat TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengajuan_rab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_ulok TEXT NOT NULL REFERENCES toko(nomor_ulok) ON UPDATE CASCADE ON DELETE RESTRICT,
  email_pembuat TEXT NOT NULL,
  nama_pt TEXT NOT NULL,
  lingkup_pekerjaan TEXT NOT NULL,
  durasi_pekerjaan TEXT NOT NULL,
  status TEXT NOT NULL,
  grand_total_nonsbo NUMERIC(18, 2) NOT NULL DEFAULT 0,
  grand_total_final NUMERIC(18, 2) NOT NULL DEFAULT 0,
  link_pdf_gabungan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detail_item_rab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_rab_id UUID NOT NULL REFERENCES pengajuan_rab(id) ON DELETE CASCADE,
  kategori_pekerjaan TEXT NOT NULL,
  jenis_pekerjaan TEXT NOT NULL,
  satuan TEXT NOT NULL,
  volume NUMERIC(18, 4) NOT NULL DEFAULT 0,
  harga_material NUMERIC(18, 2) NOT NULL DEFAULT 0,
  harga_upah NUMERIC(18, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS approval_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_rab_id UUID NOT NULL REFERENCES pengajuan_rab(id) ON DELETE CASCADE,
  approver_email TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  tindakan TEXT NOT NULL,
  alasan_penolakan TEXT,
  waktu_tindakan TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pengajuan_rab_ulok ON pengajuan_rab(nomor_ulok);
CREATE INDEX IF NOT EXISTS idx_pengajuan_rab_status ON pengajuan_rab(status);
CREATE INDEX IF NOT EXISTS idx_detail_item_rab_pengajuan ON detail_item_rab(pengajuan_rab_id);
CREATE INDEX IF NOT EXISTS idx_approval_log_pengajuan ON approval_log(pengajuan_rab_id);
