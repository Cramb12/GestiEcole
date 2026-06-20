-- Migration 002 — Secondaire : Cycle d'Orientation (7è-8è) + sections d'humanités.

-- 1. Le niveau « 7ème CTEB » devient « Cycle d'Orientation » (7è & 8è, examen ENAFEP).
UPDATE niveaux SET nom = 'Cycle d''Orientation' WHERE bulletin_template = 'cteb';

-- 2. Table des sections (pour les humanités).
CREATE TABLE IF NOT EXISTS sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         VARCHAR(120) NOT NULL,
  code        VARCHAR(30),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. La classe porte sa section (NULL pour le primaire et le cycle d'orientation).
ALTER TABLE classes ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL;

-- 4. RLS sur sections (lecture par les connectés, écriture par l'admin).
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_sections_select ON sections;
CREATE POLICY p_sections_select ON sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_sections_write ON sections;
CREATE POLICY p_sections_write ON sections FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
