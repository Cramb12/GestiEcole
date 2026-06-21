-- Migration 006 — Carnet de cotes (évaluations) + sous-périodes datées.
-- L'enseignant saisit des évaluations (devoir/interro/examen, date, /max) et
-- les notes des élèves. Le système calcule P1/P2/Examen/Total dans `notes`.

-- Sous-périodes (P1, P2) d'un trimestre/semestre : dates + statut de verrouillage.
CREATE TABLE IF NOT EXISTS sous_periodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id  UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL CHECK (numero IN (1, 2)),
  date_debut  DATE,
  date_fin    DATE,
  statut      VARCHAR(12) NOT NULL DEFAULT 'auto' CHECK (statut IN ('auto', 'proclamee', 'ouverte')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sous_periode UNIQUE (periode_id, numero)
);

-- Une évaluation (pour une classe + matière + période).
CREATE TABLE IF NOT EXISTS evaluations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id      UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  branche_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  periode_id     UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
  type           VARCHAR(15) NOT NULL CHECK (type IN ('devoir', 'interrogation', 'examen')),
  sous_periode   INTEGER CHECK (sous_periode IN (1, 2)),  -- NULL pour les examens
  date           DATE NOT NULL,
  label          VARCHAR(120),
  note_max       NUMERIC(6,2) NOT NULL DEFAULT 10,
  enseignant_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  annee_scolaire VARCHAR(20) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eval_cbp ON evaluations(classe_id, branche_id, periode_id);

-- Note d'un élève pour une évaluation.
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id  UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  eleve_id       UUID NOT NULL REFERENCES eleves(id)      ON DELETE CASCADE,
  classe_id      UUID NOT NULL REFERENCES classes(id)     ON DELETE CASCADE,  -- pour la RLS
  note           NUMERIC(6,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_eval_score UNIQUE (evaluation_id, eleve_id)
);
CREATE INDEX IF NOT EXISTS idx_evalscore_eval ON evaluation_scores(evaluation_id);

-- RLS
ALTER TABLE sous_periodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores  ENABLE ROW LEVEL SECURITY;

-- sous_periodes : lecture par tous, écriture admin (le directeur fixe dates + proclame).
DROP POLICY IF EXISTS p_sousper_select ON sous_periodes;
CREATE POLICY p_sousper_select ON sous_periodes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_sousper_write ON sous_periodes;
CREATE POLICY p_sousper_write ON sous_periodes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- evaluations : admin ou enseignant de la classe.
DROP POLICY IF EXISTS p_eval_select ON evaluations;
CREATE POLICY p_eval_select ON evaluations FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_eval_write ON evaluations;
CREATE POLICY p_eval_write ON evaluations FOR ALL TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()))
  WITH CHECK (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));

-- evaluation_scores : idem (via classe_id dénormalisé).
DROP POLICY IF EXISTS p_evalscore_select ON evaluation_scores;
CREATE POLICY p_evalscore_select ON evaluation_scores FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_evalscore_write ON evaluation_scores;
CREATE POLICY p_evalscore_write ON evaluation_scores FOR ALL TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()))
  WITH CHECK (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
