-- =====================================================================
-- Migration 010 — Module Perceptions (frais scolaires) — Phase 1 : schéma
-- Registre des paiements géré par un PERCEPTEUR. Multi-tenant (ecole_id auto),
-- cloisonné par RLS, lecture seule si l'essai est expiré. Non destructif.
--   - rôle 'percepteur'
--   - barème (frais) + réductions/exonérations
--   - paiements (registre immuable : annulation tracée, pas de suppression)
--   - conversion FC -> USD figée au moment du paiement
--   - numéro de reçu séquentiel par école
-- =====================================================================

-- 0) Rôle 'percepteur' ------------------------------------------------------
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(cname); END IF;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'teacher', 'percepteur'));
END $$;

CREATE OR REPLACE FUNCTION public.is_percepteur()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'percepteur' AND actif = TRUE);
$$;

-- 1) Paramètres finances sur l'école ---------------------------------------
ALTER TABLE ecole ADD COLUMN IF NOT EXISTS taux_fc_usd            NUMERIC(12,4);   -- FC pour 1 USD
ALTER TABLE ecole ADD COLUMN IF NOT EXISTS bulletin_exige_paiement BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Barème des frais -------------------------------------------------------
CREATE TABLE IF NOT EXISTS frais (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id       UUID NOT NULL DEFAULT public.my_ecole() REFERENCES ecole(id) ON DELETE CASCADE,
  libelle        VARCHAR(120) NOT NULL,
  montant        NUMERIC(12,2) NOT NULL,
  devise         VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (devise IN ('USD', 'FC')),
  periodicite    VARCHAR(12) NOT NULL DEFAULT 'annuel'
                 CHECK (periodicite IN ('mensuel', 'trimestre', 'semestre', 'annuel', 'unique')),
  niveau_id      UUID REFERENCES niveaux(id) ON DELETE CASCADE,   -- NULL = tous les niveaux
  annee_scolaire VARCHAR(20),
  actif          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Réductions / exonérations (par élève) ----------------------------------
CREATE TABLE IF NOT EXISTS frais_reductions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id     UUID NOT NULL DEFAULT public.my_ecole() REFERENCES ecole(id) ON DELETE CASCADE,
  eleve_id     UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  frais_id     UUID REFERENCES frais(id) ON DELETE CASCADE,        -- NULL = tous les frais
  pourcentage  NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (pourcentage >= 0 AND pourcentage <= 100),
  motif        VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (eleve_id, frais_id)
);

-- 4) Paiements (registre) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS paiements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id      UUID NOT NULL DEFAULT public.my_ecole() REFERENCES ecole(id) ON DELETE CASCADE,
  eleve_id      UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  frais_id      UUID REFERENCES frais(id) ON DELETE SET NULL,
  tranche       INT NOT NULL DEFAULT 1,
  tranche_label VARCHAR(40),
  montant       NUMERIC(12,2) NOT NULL CHECK (montant > 0),
  devise        VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (devise IN ('USD', 'FC')),
  taux_fc_usd   NUMERIC(12,4),                                     -- figé au paiement (FC pour 1 USD)
  montant_usd   NUMERIC(12,2) GENERATED ALWAYS AS
                (CASE WHEN devise = 'USD' THEN montant
                      ELSE ROUND(montant / NULLIF(taux_fc_usd, 0), 2) END) STORED,
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode          VARCHAR(12) NOT NULL DEFAULT 'especes'
                CHECK (mode IN ('especes', 'airtel', 'orange', 'mpesa', 'banque', 'autre')),
  recu_numero   VARCHAR(20),
  percepteur_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  annule        BOOLEAN NOT NULL DEFAULT FALSE,
  annule_motif  VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Numérotation des reçus (séquence par école) ----------------------------
CREATE TABLE IF NOT EXISTS recu_compteur (
  ecole_id UUID PRIMARY KEY REFERENCES ecole(id) ON DELETE CASCADE,
  dernier  INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.assign_recu_numero()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  IF NEW.recu_numero IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.ecole_id IS NULL THEN NEW.ecole_id := public.my_ecole(); END IF;
  INSERT INTO public.recu_compteur(ecole_id, dernier) VALUES (NEW.ecole_id, 1)
    ON CONFLICT (ecole_id) DO UPDATE SET dernier = public.recu_compteur.dernier + 1
    RETURNING dernier INTO n;
  NEW.recu_numero := 'REC-' || LPAD(n::text, 6, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recu_numero ON paiements;
CREATE TRIGGER trg_recu_numero BEFORE INSERT ON paiements
  FOR EACH ROW EXECUTE FUNCTION public.assign_recu_numero();

-- 6) Index ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_frais_ecole       ON frais(ecole_id);
CREATE INDEX IF NOT EXISTS idx_fraisred_ecole     ON frais_reductions(ecole_id);
CREATE INDEX IF NOT EXISTS idx_fraisred_eleve     ON frais_reductions(eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_ecole    ON paiements(ecole_id);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve    ON paiements(eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_date     ON paiements(date_paiement);

-- 7) RLS --------------------------------------------------------------------
ALTER TABLE frais            ENABLE ROW LEVEL SECURITY;
ALTER TABLE frais_reductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recu_compteur    ENABLE ROW LEVEL SECURITY;   -- aucune policy : seul le trigger (SECURITY DEFINER) y touche

-- Barème + réductions : lecture par l'école, écriture directeur (bloquée si expiré).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['frais', 'frais_reductions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS t_%1$s_select ON %1$s', t);
    EXECUTE format($f$CREATE POLICY t_%1$s_select ON %1$s FOR SELECT TO authenticated
      USING (ecole_id = public.my_ecole())$f$, t);
    EXECUTE format('DROP POLICY IF EXISTS t_%1$s_write ON %1$s', t);
    EXECUTE format($f$CREATE POLICY t_%1$s_write ON %1$s FOR ALL TO authenticated
      USING (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))
      WITH CHECK (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))$f$, t);
  END LOOP;
END $$;

-- Paiements : lus/écrits par le directeur OU le percepteur (écriture bloquée si expiré).
DROP POLICY IF EXISTS t_paiements_select ON paiements;
CREATE POLICY t_paiements_select ON paiements FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole() AND (public.is_admin() OR public.is_percepteur()));
DROP POLICY IF EXISTS t_paiements_write ON paiements;
CREATE POLICY t_paiements_write ON paiements FOR ALL TO authenticated
  USING (ecole_id = public.my_ecole() AND public.ecole_active(public.my_ecole()) AND (public.is_admin() OR public.is_percepteur()))
  WITH CHECK (ecole_id = public.my_ecole() AND public.ecole_active(public.my_ecole()) AND (public.is_admin() OR public.is_percepteur()));

-- 8) Le percepteur doit pouvoir lire les élèves de son école (il n'a pas de classes).
DROP POLICY IF EXISTS t_eleves_select ON eleves;
CREATE POLICY t_eleves_select ON eleves FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole()
         AND (public.is_admin() OR public.is_percepteur() OR classe_id IN (SELECT public.my_classe_ids())));
