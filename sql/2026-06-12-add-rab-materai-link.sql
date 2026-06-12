ALTER TABLE rab
ADD COLUMN IF NOT EXISTS link_pdf_materai TEXT;

CREATE INDEX IF NOT EXISTS idx_rab_link_pdf_materai
ON rab (link_pdf_materai)
WHERE link_pdf_materai IS NOT NULL;
