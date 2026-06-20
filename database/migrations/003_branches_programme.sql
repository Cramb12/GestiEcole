-- Migration 003 — matières par programme (section + année + sous-groupe).
-- Permet des matières propres à chaque section/année d'humanités, et le
-- sous-groupe (ex. FRANÇAIS) pour les sous-totaux du bulletin.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS section_id   UUID REFERENCES sections(id) ON DELETE SET NULL;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS annee        VARCHAR(10);   -- '5','6','7','8','1'..'4','1-2' ou NULL
ALTER TABLE branches ADD COLUMN IF NOT EXISTS sous_domaine VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_branches_section ON branches(section_id);
