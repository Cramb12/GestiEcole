-- =====================================================================
-- Migration 012 — Rôle "chargé des inscriptions" (inscripteur)
-- Gère UNIQUEMENT les élèves : inscription / modification + affectation
-- à une classe. Aucun accès aux notes, bulletins, finances ni promotions.
-- Multi-tenant (ecole_id auto), écriture bloquée si l'essai est expiré.
-- Non destructif.
-- =====================================================================

-- 0) Étendre la contrainte de rôle pour inclure 'inscripteur'.
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(cname); END IF;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'teacher', 'percepteur', 'inscripteur'));
END $$;

-- 1) Helper : l'appelant est-il un inscripteur actif ?
CREATE OR REPLACE FUNCTION public.is_inscripteur()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'inscripteur' AND actif = TRUE);
$$;

-- 2) ELEVES — lecture : admin / percepteur / inscripteur / enseignant (ses classes).
DROP POLICY IF EXISTS t_eleves_select ON eleves;
CREATE POLICY t_eleves_select ON eleves FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole()
         AND (public.is_admin() OR public.is_percepteur() OR public.is_inscripteur()
              OR classe_id IN (SELECT public.my_classe_ids())));

-- 3) ELEVES — l'inscripteur peut INSÉRER et METTRE À JOUR les élèves de son
-- école (jamais SUPPRIMER ; la suppression reste réservée à l'administrateur).
-- Écriture bloquée si la période d'essai est expirée.
DROP POLICY IF EXISTS t_eleves_insc_insert ON eleves;
CREATE POLICY t_eleves_insc_insert ON eleves FOR INSERT TO authenticated
  WITH CHECK (ecole_id = public.my_ecole() AND public.is_inscripteur() AND public.ecole_active(public.my_ecole()));

DROP POLICY IF EXISTS t_eleves_insc_update ON eleves;
CREATE POLICY t_eleves_insc_update ON eleves FOR UPDATE TO authenticated
  USING (ecole_id = public.my_ecole() AND public.is_inscripteur() AND public.ecole_active(public.my_ecole()))
  WITH CHECK (ecole_id = public.my_ecole() AND public.is_inscripteur() AND public.ecole_active(public.my_ecole()));
