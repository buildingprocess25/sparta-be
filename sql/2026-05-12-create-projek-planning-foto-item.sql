-- ============================================================
-- Projek Planning Foto Item (Untuk 38 Titik Foto)
-- ============================================================

CREATE TABLE IF NOT EXISTS projek_planning_foto_item (
    id SERIAL PRIMARY KEY,
    id_projek_planning INT NOT NULL,
    item_index INT NOT NULL,
    link_foto VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT fk_projek_planning_foto_item
        FOREIGN KEY (id_projek_planning)
        REFERENCES projek_planning(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projek_planning_foto_item_projek ON projek_planning_foto_item(id_projek_planning);
