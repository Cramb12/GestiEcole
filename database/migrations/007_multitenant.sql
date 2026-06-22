-- =====================================================================
-- Migration 007 — Multi-tenant, Phase A : clé de locataire + essai
-- (N'AJOUTE PAS encore le cloisonnement RLS — voir Phase B. Cette migration
--  est non destructive : elle ajoute des colonnes, remplit les données
--  existantes et installe les fonctions. L'application continue de marcher.)
-- =====================================================================

-- 1) Statut d'abonnement / essai sur l'école -------------------------------
ALTER TABLE ecole ADD COLUMN IF NOT EXISTS statut         VARCHAR(20) NOT NULL DEFAULT 'essai';
ALTER TABLE ecole ADD COLUMN IF NOT EXISTS essai_fin      DATE;
ALTER TABLE ecole ADD COLUMN IF NOT EXISTS abonnement_fin DATE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecole_statut_chk') THEN
    ALTER TABLE ecole ADD CONSTRAINT ecole_statut_chk
      CHECK (statut IN ('essai', 'actif', 'expire', 'suspendu'));
  END IF;
END $$;

-- 2) Colonne ecole_id (locataire) sur profiles + toutes les tables de données
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','niveaux','sections','classes','eleves','branches',
    'enseignant_branches','periodes','notes','presences','appreciation',
    'promotions_history','creneaux','horaires','sous_periodes',
    'evaluations','evaluation_scores'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS ecole_id UUID REFERENCES ecole(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_ecole ON %I(ecole_id)', t, t);
  END LOOP;
END $$;

-- 3) Remplissage : rattacher l'existant à l'unique école (= l'école de démo),
--    et la marquer "actif" pour qu'elle reste une vitrine permanente.
DO $$
DECLARE eid UUID; t TEXT;
BEGIN
  SELECT id INTO eid FROM ecole ORDER BY created_at LIMIT 1;
  IF eid IS NULL THEN RETURN; END IF;
  UPDATE ecole SET statut = 'actif' WHERE id = eid;
  FOREACH t IN ARRAY ARRAY[
    'profiles','niveaux','sections','classes','eleves','branches',
    'enseignant_branches','periodes','notes','presences','appreciation',
    'promotions_history','creneaux','horaires','sous_periodes',
    'evaluations','evaluation_scores'
  ] LOOP
    EXECUTE format('UPDATE %I SET ecole_id = %L WHERE ecole_id IS NULL', t, eid);
  END LOOP;
END $$;

-- 4) Fonctions d'aide (utilisées par le RLS en Phase B et par l'UI) ---------

-- L'école de l'utilisateur connecté.
CREATE OR REPLACE FUNCTION public.my_ecole()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ecole_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Vrai si l'école peut écrire (abonnée, ou en essai non expiré).
CREATE OR REPLACE FUNCTION public.ecole_active(eid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ecole
    WHERE id = eid
      AND (statut = 'actif'
           OR (statut = 'essai' AND COALESCE(essai_fin, CURRENT_DATE) >= CURRENT_DATE))
  );
$$;

-- 5) Auto-remplissage de ecole_id à l'insertion depuis le compte connecté.
--    (Les insertions front n'ont donc pas besoin de fournir ecole_id.)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'niveaux','sections','classes','eleves','branches',
    'enseignant_branches','periodes','notes','presences','appreciation',
    'promotions_history','creneaux','horaires','sous_periodes',
    'evaluations','evaluation_scores'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN ecole_id SET DEFAULT public.my_ecole()', t);
  END LOOP;
END $$;
