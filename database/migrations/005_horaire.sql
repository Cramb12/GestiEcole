-- Migration 005 — Emploi du temps (horaire des cours).
-- creneaux = plages horaires (configurables) ; horaires = qui/quoi par
-- classe, jour et créneau. L'affectation (enseignant_branches) est créée
-- automatiquement à partir de l'horaire (logique applicative).

CREATE TABLE IF NOT EXISTS creneaux (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordre        INTEGER NOT NULL DEFAULT 0,
  label        VARCHAR(60) NOT NULL,
  heure_debut  VARCHAR(5),                 -- 'HH:MM'
  heure_fin    VARCHAR(5),
  type         VARCHAR(10) NOT NULL DEFAULT 'cours' CHECK (type IN ('cours','pause')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS horaires (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id      UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  creneau_id     UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  jour           INTEGER NOT NULL CHECK (jour BETWEEN 1 AND 7),  -- 1=Lundi … 6=Samedi
  branche_id     UUID REFERENCES branches(id) ON DELETE SET NULL,
  enseignant_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  salle          VARCHAR(40),
  annee_scolaire VARCHAR(20) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_horaire UNIQUE (classe_id, creneau_id, jour, annee_scolaire)
);
CREATE INDEX IF NOT EXISTS idx_horaires_classe ON horaires(classe_id);
CREATE INDEX IF NOT EXISTS idx_horaires_ens    ON horaires(enseignant_id);

ALTER TABLE creneaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE horaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_creneaux_select ON creneaux;
CREATE POLICY p_creneaux_select ON creneaux FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_creneaux_write ON creneaux;
CREATE POLICY p_creneaux_write ON creneaux FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS p_horaires_select ON horaires;
CREATE POLICY p_horaires_select ON horaires FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_horaires_write ON horaires;
CREATE POLICY p_horaires_write ON horaires FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Créneaux par défaut (matinée : 6 leçons de 50 min + récréation), si vide.
INSERT INTO creneaux (ordre, label, heure_debut, heure_fin, type)
SELECT * FROM (VALUES
  (1, '1ère heure', '07:30', '08:20', 'cours'),
  (2, '2ème heure', '08:20', '09:10', 'cours'),
  (3, '3ème heure', '09:10', '10:00', 'cours'),
  (4, 'Récréation', '10:00', '10:15', 'pause'),
  (5, '4ème heure', '10:15', '11:05', 'cours'),
  (6, '5ème heure', '11:05', '11:55', 'cours'),
  (7, '6ème heure', '11:55', '12:45', 'cours')
) AS v(ordre, label, heure_debut, heure_fin, type)
WHERE NOT EXISTS (SELECT 1 FROM creneaux);
