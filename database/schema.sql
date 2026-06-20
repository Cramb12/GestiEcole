-- =====================================================================
-- SYSTÈME DE GESTION SCOLAIRE — RDC
-- Schéma complet (toutes les tables des 8 phases, conçues dès la Phase 1)
-- Cible : PostgreSQL (Supabase). Exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- Extension pour générer des UUID (Supabase: déjà disponible)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Nettoyage (à utiliser avec prudence : supprime tout en cascade)
-- Décommentez ces lignes pour repartir de zéro.
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS promotions_history CASCADE;
-- DROP TABLE IF EXISTS appreciation CASCADE;
-- DROP TABLE IF EXISTS presences CASCADE;
-- DROP TABLE IF EXISTS notes CASCADE;
-- DROP TABLE IF EXISTS periodes CASCADE;
-- DROP TABLE IF EXISTS enseignant_branches CASCADE;
-- DROP TABLE IF EXISTS branches CASCADE;
-- DROP TABLE IF EXISTS eleves CASCADE;
-- DROP TABLE IF EXISTS classes CASCADE;
-- DROP TABLE IF EXISTS niveaux CASCADE;
-- DROP TABLE IF EXISTS ecole CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================
-- 1. USERS — Comptes (super_admin | teacher)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(100) NOT NULL,
    postnom     VARCHAR(100),
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,                 -- hashé avec bcrypt
    role        VARCHAR(20)  NOT NULL DEFAULT 'teacher'
                CHECK (role IN ('super_admin', 'teacher')),
    actif       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 2. ECOLE — Informations de l'école (un seul enregistrement attendu)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ecole (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_ecole       VARCHAR(200) NOT NULL,
    province        VARCHAR(100),
    ville           VARCHAR(100),
    commune         VARCHAR(100),
    code_ecole      VARCHAR(50),
    logo_url        TEXT,
    annee_scolaire  VARCHAR(20)  NOT NULL,             -- ex: "2025-2026"
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. NIVEAUX — Niveaux scolaires
-- =====================================================================
CREATE TABLE IF NOT EXISTS niveaux (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                 VARCHAR(100) NOT NULL,          -- "Élémentaire", "Moyen", ...
    type                VARCHAR(20)  NOT NULL
                        CHECK (type IN ('primaire', 'secondaire')),
    systeme_periodes    VARCHAR(20)  NOT NULL
                        CHECK (systeme_periodes IN ('trimestre', 'semestre')),
    bulletin_template   VARCHAR(30)  NOT NULL
                        CHECK (bulletin_template IN
                          ('elementaire','moyen','terminal','cteb','humanites')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. CLASSES — Classes
-- =====================================================================
CREATE TABLE IF NOT EXISTS classes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(50)  NOT NULL,              -- ex: "1ère A"
    niveau_id       UUID NOT NULL REFERENCES niveaux(id) ON DELETE RESTRICT,
    annee_scolaire  VARCHAR(20)  NOT NULL,
    titulaire_id    UUID REFERENCES users(id) ON DELETE SET NULL,  -- enseignant titulaire
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. ELEVES — Élèves
-- =====================================================================
CREATE TABLE IF NOT EXISTS eleves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(100) NOT NULL,
    postnom         VARCHAR(100),
    prenom          VARCHAR(100),
    sexe            CHAR(1) CHECK (sexe IN ('M', 'F')),
    date_naissance  DATE,
    lieu_naissance  VARCHAR(120),
    numero_perm     VARCHAR(50)  NOT NULL,              -- N° Permanent (unique par année)
    classe_id       UUID REFERENCES classes(id) ON DELETE SET NULL,
    annee_scolaire  VARCHAR(20)  NOT NULL,
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_eleve_perm_annee UNIQUE (numero_perm, annee_scolaire)
);

-- =====================================================================
-- 6. BRANCHES — Matières / cours
-- =====================================================================
CREATE TABLE IF NOT EXISTS branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(120) NOT NULL,
    domaine     VARCHAR(150),                           -- regroupement (domaine / maxima)
    max_points  INTEGER NOT NULL DEFAULT 0,
    niveau_id   UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
    ordre       INTEGER NOT NULL DEFAULT 0,             -- ordre d'affichage sur le bulletin
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 7. ENSEIGNANT_BRANCHES — Affectations (enseignant ↔ matière ↔ classe)
-- =====================================================================
CREATE TABLE IF NOT EXISTS enseignant_branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    branche_id      UUID NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
    classe_id       UUID NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
    annee_scolaire  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_affectation UNIQUE (teacher_id, branche_id, classe_id, annee_scolaire)
);

-- =====================================================================
-- 8. PERIODES — Trimestres / Semestres
-- =====================================================================
CREATE TABLE IF NOT EXISTS periodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(60) NOT NULL,               -- "1er Trimestre", "2ème Semestre"
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('trimestre', 'semestre')),
    niveau_id       UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
    numero          INTEGER NOT NULL,                   -- 1, 2, 3
    annee_scolaire  VARCHAR(20) NOT NULL,
    date_debut      DATE,
    date_fin        DATE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,     -- verrouillé = saisie interdite
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 9. NOTES — Notes / cotes
-- =====================================================================
CREATE TABLE IF NOT EXISTS notes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id                UUID NOT NULL REFERENCES eleves(id)   ON DELETE CASCADE,
    branche_id              UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    periode_id              UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
    classe_id               UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    points_journaliers_1    NUMERIC(6,2),                -- travaux journaliers période 1
    points_journaliers_2    NUMERIC(6,2),                -- travaux journaliers période 2
    points_examen           NUMERIC(6,2),                -- points d'examen
    points_obtenus          NUMERIC(6,2),                -- total calculé pour la période
    max_periode             NUMERIC(6,2),                -- maximum pour la période
    annee_scolaire          VARCHAR(20) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_note UNIQUE (eleve_id, branche_id, periode_id)
);

-- =====================================================================
-- 10. PRESENCES — Présences
-- =====================================================================
CREATE TABLE IF NOT EXISTS presences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id        UUID NOT NULL REFERENCES eleves(id)   ON DELETE CASCADE,
    classe_id       UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    branche_id      UUID REFERENCES branches(id) ON DELETE CASCADE,  -- NULL = primaire (journalier)
    date            DATE NOT NULL,
    statut          VARCHAR(15) NOT NULL DEFAULT 'present'
                    CHECK (statut IN ('present', 'absent', 'retard')),
    periode_id      UUID REFERENCES periodes(id) ON DELETE SET NULL,
    note_absence    TEXT,                                -- ex: "certificat médical"
    enseignant_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    annee_scolaire  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. APPRECIATION — Application, conduite, délibération
-- =====================================================================
CREATE TABLE IF NOT EXISTS appreciation (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id                UUID NOT NULL REFERENCES eleves(id)   ON DELETE CASCADE,
    classe_id               UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    periode_id              UUID NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
    application             VARCHAR(50),
    conduite                VARCHAR(50),
    appreciation_generale   TEXT,
    deliberation            VARCHAR(20)
                            CHECK (deliberation IN ('passe','double','repechage')),
    signe_titulaire         BOOLEAN NOT NULL DEFAULT FALSE,
    signe_directeur         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_appreciation UNIQUE (eleve_id, periode_id)
);

-- =====================================================================
-- 12. PROMOTIONS_HISTORY — Historique des promotions / redoublements
--     (utilisé en Phase 3 pour conserver l'historique année par année)
-- =====================================================================
CREATE TABLE IF NOT EXISTS promotions_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id            UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
    annee_scolaire      VARCHAR(20) NOT NULL,
    classe_id           UUID REFERENCES classes(id) ON DELETE SET NULL,
    decision            VARCHAR(20)
                        CHECK (decision IN ('promu','redoublant','exclu','termine')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- INDEX — colonnes fréquemment interrogées (perf. Phase 8 anticipée)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_eleves_classe        ON eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_eleves_annee         ON eleves(annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_classes_niveau       ON classes(niveau_id);
CREATE INDEX IF NOT EXISTS idx_branches_niveau      ON branches(niveau_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve          ON notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_classe         ON notes(classe_id);
CREATE INDEX IF NOT EXISTS idx_notes_periode        ON notes(periode_id);
CREATE INDEX IF NOT EXISTS idx_presences_eleve      ON presences(eleve_id);
CREATE INDEX IF NOT EXISTS idx_presences_classe     ON presences(classe_id);
CREATE INDEX IF NOT EXISTS idx_presences_date       ON presences(date);
CREATE INDEX IF NOT EXISTS idx_affect_teacher       ON enseignant_branches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_appreciation_eleve   ON appreciation(eleve_id);

-- =====================================================================
-- FIN DU SCHÉMA
-- =====================================================================
