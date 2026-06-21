-- ============================================================
-- INSTALLATION COMPLETE — Systeme de gestion scolaire RDC
-- Un seul fichier a executer dans le SQL Editor de Supabase
-- pour installer toute la base d'une nouvelle ecole.
-- (schema + migrations 005/006 + storage)
-- ============================================================

-- =====================================================================
-- SYSTÈME DE GESTION SCOLAIRE — RDC  (Architecture Supabase-only)
-- Schéma complet : toutes les tables + Row Level Security (RLS).
-- Cible : Supabase. Exécuter dans le SQL Editor.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. PROFILES — profil applicatif lié à un compte Supabase Auth.
--    (remplace l'ancienne table "users" ; l'email/mot de passe sont
--     gérés par Supabase Auth dans le schéma auth.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom         VARCHAR(100) NOT NULL,
    postnom     VARCHAR(100),
    email       VARCHAR(150),
    role        VARCHAR(20) NOT NULL DEFAULT 'teacher'
                CHECK (role IN ('super_admin', 'teacher')),
    actif       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 2. ECOLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS ecole (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_ecole       VARCHAR(200) NOT NULL,
    province        VARCHAR(100),
    ville           VARCHAR(100),
    commune         VARCHAR(100),
    code_ecole      VARCHAR(50),
    logo_url        TEXT,
    annee_scolaire  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. NIVEAUX
-- =====================================================================
CREATE TABLE IF NOT EXISTS niveaux (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                 VARCHAR(100) NOT NULL,
    type                VARCHAR(20) NOT NULL CHECK (type IN ('primaire','secondaire')),
    systeme_periodes    VARCHAR(20) NOT NULL CHECK (systeme_periodes IN ('trimestre','semestre')),
    bulletin_template   VARCHAR(30) NOT NULL
                        CHECK (bulletin_template IN ('elementaire','moyen','terminal','cteb','humanites')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3b. SECTIONS (pour les humanités ; assignées aux classes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(120) NOT NULL,
    code        VARCHAR(30),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. CLASSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS classes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(50) NOT NULL,
    niveau_id       UUID NOT NULL REFERENCES niveaux(id) ON DELETE RESTRICT,
    section_id      UUID REFERENCES sections(id) ON DELETE SET NULL,
    annee           VARCHAR(10),                        -- année d'études '1'..'8'
    annee_scolaire  VARCHAR(20) NOT NULL,
    titulaire_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. ELEVES
-- =====================================================================
CREATE TABLE IF NOT EXISTS eleves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(100) NOT NULL,
    postnom         VARCHAR(100),
    prenom          VARCHAR(100),
    sexe            CHAR(1) CHECK (sexe IN ('M','F')),
    date_naissance  DATE,
    lieu_naissance  VARCHAR(120),
    numero_perm     VARCHAR(50) NOT NULL,
    ecole_provenance VARCHAR(200),                      -- école d'origine (élève transféré)
    classe_id       UUID REFERENCES classes(id) ON DELETE SET NULL,
    annee_scolaire  VARCHAR(20) NOT NULL,
    actif           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_eleve_perm_annee UNIQUE (numero_perm, annee_scolaire)
);

-- =====================================================================
-- 6. BRANCHES
-- =====================================================================
CREATE TABLE IF NOT EXISTS branches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom          VARCHAR(120) NOT NULL,
    domaine      VARCHAR(150),
    sous_domaine VARCHAR(150),                          -- sous-groupe (ex: FRANÇAIS)
    max_points   INTEGER NOT NULL DEFAULT 0,            -- maximum par période
    niveau_id    UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
    section_id   UUID REFERENCES sections(id) ON DELETE SET NULL,  -- humanités
    annee        VARCHAR(10),                           -- '5','6','7','8','1'..'4','1-2' ou NULL
    ordre        INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 7. ENSEIGNANT_BRANCHES
-- =====================================================================
CREATE TABLE IF NOT EXISTS enseignant_branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branche_id      UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    classe_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    annee_scolaire  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_affectation UNIQUE (teacher_id, branche_id, classe_id, annee_scolaire)
);

-- =====================================================================
-- 8. PERIODES
-- =====================================================================
CREATE TABLE IF NOT EXISTS periodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(60) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('trimestre','semestre')),
    niveau_id       UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
    numero          INTEGER NOT NULL,
    annee_scolaire  VARCHAR(20) NOT NULL,
    date_debut      DATE,
    date_fin        DATE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 9. NOTES
-- =====================================================================
CREATE TABLE IF NOT EXISTS notes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id                UUID NOT NULL REFERENCES eleves(id)   ON DELETE CASCADE,
    branche_id              UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    periode_id              UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
    classe_id               UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    points_journaliers_1    NUMERIC(6,2),
    points_journaliers_2    NUMERIC(6,2),
    points_examen           NUMERIC(6,2),
    points_obtenus          NUMERIC(6,2),
    max_periode             NUMERIC(6,2),
    annee_scolaire          VARCHAR(20) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_note UNIQUE (eleve_id, branche_id, periode_id)
);

-- =====================================================================
-- 10. PRESENCES
-- =====================================================================
CREATE TABLE IF NOT EXISTS presences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id        UUID NOT NULL REFERENCES eleves(id)  ON DELETE CASCADE,
    classe_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    branche_id      UUID REFERENCES branches(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    statut          VARCHAR(15) NOT NULL DEFAULT 'present'
                    CHECK (statut IN ('present','absent','retard')),
    periode_id      UUID REFERENCES periodes(id) ON DELETE SET NULL,
    note_absence    TEXT,
    enseignant_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    annee_scolaire  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. APPRECIATION
-- =====================================================================
CREATE TABLE IF NOT EXISTS appreciation (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id                UUID NOT NULL REFERENCES eleves(id)   ON DELETE CASCADE,
    classe_id               UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    periode_id              UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
    application             VARCHAR(50),
    conduite                VARCHAR(50),
    appreciation_generale   TEXT,
    deliberation            VARCHAR(20) CHECK (deliberation IN ('passe','double','repechage')),
    signe_titulaire         BOOLEAN NOT NULL DEFAULT FALSE,
    signe_directeur         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_appreciation UNIQUE (eleve_id, periode_id)
);

-- =====================================================================
-- 12. PROMOTIONS_HISTORY
-- =====================================================================
CREATE TABLE IF NOT EXISTS promotions_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id        UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
    annee_scolaire  VARCHAR(20) NOT NULL,
    classe_id       UUID REFERENCES classes(id) ON DELETE SET NULL,
    decision        VARCHAR(20) CHECK (decision IN ('promu','redoublant','exclu','termine')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- INDEX
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_eleves_classe      ON eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_eleves_annee       ON eleves(annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_classes_niveau     ON classes(niveau_id);
CREATE INDEX IF NOT EXISTS idx_branches_niveau    ON branches(niveau_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve        ON notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_classe       ON notes(classe_id);
CREATE INDEX IF NOT EXISTS idx_notes_periode      ON notes(periode_id);
CREATE INDEX IF NOT EXISTS idx_presences_eleve    ON presences(eleve_id);
CREATE INDEX IF NOT EXISTS idx_presences_classe   ON presences(classe_id);
CREATE INDEX IF NOT EXISTS idx_presences_date     ON presences(date);
CREATE INDEX IF NOT EXISTS idx_affect_teacher     ON enseignant_branches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_appreciation_eleve ON appreciation(eleve_id);

-- =====================================================================
-- FONCTIONS D'AIDE POUR LA SÉCURITÉ (SECURITY DEFINER = pas de récursion RLS)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND actif = TRUE
  );
$$;

-- Classes que l'utilisateur courant peut « toucher » (titulaire OU affecté).
CREATE OR REPLACE FUNCTION public.my_classe_ids()
RETURNS SETOF UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.classes WHERE titulaire_id = auth.uid()
  UNION
  SELECT classe_id FROM public.enseignant_branches WHERE teacher_id = auth.uid();
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecole               ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveaux             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleves              ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE enseignant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appreciation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions_history  ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES : on lit son propre profil ; l'admin lit/écrit tout ----
DROP POLICY IF EXISTS p_profiles_select ON profiles;
CREATE POLICY p_profiles_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS p_profiles_write ON profiles;
CREATE POLICY p_profiles_write ON profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- Tables de configuration : lecture par tous les connectés, écriture admin ----
-- (ecole, niveaux, classes, branches, periodes)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ecole','niveaux','sections','classes','branches','periodes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_%1$s_select ON %1$s', t);
    EXECUTE format('CREATE POLICY p_%1$s_select ON %1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS p_%1$s_write ON %1$s', t);
    EXECUTE format('CREATE POLICY p_%1$s_write ON %1$s FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- ---- ELEVES : admin tout ; enseignant lit les élèves de SES classes ----
DROP POLICY IF EXISTS p_eleves_select ON eleves;
CREATE POLICY p_eleves_select ON eleves FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_eleves_write ON eleves;
CREATE POLICY p_eleves_write ON eleves FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- ENSEIGNANT_BRANCHES : admin tout ; enseignant voit ses affectations ----
DROP POLICY IF EXISTS p_affect_select ON enseignant_branches;
CREATE POLICY p_affect_select ON enseignant_branches FOR SELECT TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());
DROP POLICY IF EXISTS p_affect_write ON enseignant_branches;
CREATE POLICY p_affect_write ON enseignant_branches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- NOTES : admin tout ; enseignant gère les notes de ses classes ----
DROP POLICY IF EXISTS p_notes_select ON notes;
CREATE POLICY p_notes_select ON notes FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_notes_write ON notes;
CREATE POLICY p_notes_write ON notes FOR ALL TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()))
  WITH CHECK (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));

-- ---- PRESENCES : idem notes ----
DROP POLICY IF EXISTS p_presences_select ON presences;
CREATE POLICY p_presences_select ON presences FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_presences_write ON presences;
CREATE POLICY p_presences_write ON presences FOR ALL TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()))
  WITH CHECK (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));

-- ---- APPRECIATION : admin tout ; titulaire de la classe ----
DROP POLICY IF EXISTS p_appreciation_select ON appreciation;
CREATE POLICY p_appreciation_select ON appreciation FOR SELECT TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));
DROP POLICY IF EXISTS p_appreciation_write ON appreciation;
CREATE POLICY p_appreciation_write ON appreciation FOR ALL TO authenticated
  USING (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()))
  WITH CHECK (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids()));

-- ---- PROMOTIONS_HISTORY : admin uniquement (écriture), lecture connectés ----
DROP POLICY IF EXISTS p_promo_select ON promotions_history;
CREATE POLICY p_promo_select ON promotions_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_promo_write ON promotions_history;
CREATE POLICY p_promo_write ON promotions_history FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =====================================================================
-- FIN DU SCHÉMA
-- Note : la clé "service_role" (utilisée par le script de seed) contourne
-- la RLS. Ne jamais l'exposer côté frontend — seul le client utilise la
-- clé "anon", protégée par les politiques ci-dessus.
-- =====================================================================

-- ===== MIGRATION 005 : EMPLOI DU TEMPS =====
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

-- ===== MIGRATION 006 : EVALUATIONS / CARNET DE COTES =====
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

-- ===== STORAGE : bucket logo =====
-- =====================================================================
-- STORAGE — bucket public "ecole" pour le logo de l'école.
-- À exécuter une fois dans le SQL Editor de Supabase.
-- =====================================================================

-- Bucket public (les logos doivent être visibles sur les bulletins).
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecole', 'ecole', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique des fichiers du bucket.
DROP POLICY IF EXISTS "ecole_public_read" ON storage.objects;
CREATE POLICY "ecole_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ecole');

-- Écriture (upload / remplacement / suppression) réservée aux admins.
DROP POLICY IF EXISTS "ecole_admin_write" ON storage.objects;
CREATE POLICY "ecole_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ecole' AND public.is_admin())
  WITH CHECK (bucket_id = 'ecole' AND public.is_admin());
