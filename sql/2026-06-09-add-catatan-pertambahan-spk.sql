ALTER TABLE pertambahan_spk ADD COLUMN IF NOT EXISTS catatan_approval VARCHAR(500);
ALTER TABLE pertambahan_spk ADD COLUMN IF NOT EXISTS catatan_penolakan VARCHAR(500);
