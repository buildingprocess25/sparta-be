-- 2026-08-12-create-toko-kpi-metrics.sql

CREATE TABLE IF NOT EXISTS toko_kpi_metrics (
    id SERIAL PRIMARY KEY,
    id_toko INT NOT NULL UNIQUE,
    tanggal_notaris_start DATE,
    tanggal_notaris_end DATE,
    persentase_temuan NUMERIC(5, 2),
    deviasi_pe NUMERIC(5, 2),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_toko_kpi_metrics_toko FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_toko_kpi_metrics_id_toko ON toko_kpi_metrics(id_toko);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_toko_kpi_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('Asia/Jakarta', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_toko_kpi_metrics_updated_at_trigger ON toko_kpi_metrics;
CREATE TRIGGER update_toko_kpi_metrics_updated_at_trigger
BEFORE UPDATE ON toko_kpi_metrics
FOR EACH ROW
EXECUTE FUNCTION update_toko_kpi_metrics_updated_at();
