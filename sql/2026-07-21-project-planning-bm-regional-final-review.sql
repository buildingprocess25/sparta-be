-- Add audit fields for B&M Regional Manager stage-2 RAB/final drawing review.

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS bm_regional_rab_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bm_regional_gambar_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bm_regional_rab_rejected_item_ids INTEGER[],
    ADD COLUMN IF NOT EXISTS bm_regional_rab_rejected_item_notes TEXT;
