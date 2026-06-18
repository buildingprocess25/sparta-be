CREATE TABLE IF NOT EXISTS pengawasan_pdf_migration_pending (
    id BIGSERIAL PRIMARY KEY,
    nomor_ulok TEXT NOT NULL,
    lingkup_pekerjaan TEXT NOT NULL DEFAULT '',
    h_day INTEGER NOT NULL,
    tanggal_pengawasan TEXT,
    link_pdf_pengawasan TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    id_pengawasan_gantt INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_pengawasan_pdf_pending_gantt
        FOREIGN KEY (id_pengawasan_gantt)
        REFERENCES pengawasan_gantt(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_pengawasan_pdf_pending_status
        CHECK (status IN ('PENDING', 'LINKED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pengawasan_pdf_pending_source
ON pengawasan_pdf_migration_pending (
    nomor_ulok,
    lingkup_pekerjaan,
    h_day,
    source_sheet,
    source_row
);

CREATE INDEX IF NOT EXISTS idx_pengawasan_pdf_pending_lookup
ON pengawasan_pdf_migration_pending (nomor_ulok, h_day, status);
