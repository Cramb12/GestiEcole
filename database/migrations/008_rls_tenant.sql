-- =====================================================================
-- Migration 008 — Multi-tenant, Phase B : cloisonnement RLS + lecture seule
-- Chaque politique :
--   - ne voit/écrit que les lignes de SON école  (ecole_id = my_ecole())
--   - les ÉCRITURES sont bloquées si l'essai est expiré (ecole_active) ->
--     l'école passe en LECTURE SEULE jusqu'au paiement.
-- IMPORTANT : is_admin() est global (rôle), il est donc TOUJOURS combiné au
-- filtre d'école pour éviter qu'un directeur voie une autre école.
-- (Dépend de la migration 007. La clé service_role contourne la RLS.)
-- =====================================================================

-- 0) Table rase : supprimer toutes les politiques existantes sur ces tables.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
             'profiles','ecole','niveaux','sections','classes','eleves','branches',
             'enseignant_branches','periodes','notes','presences','appreciation',
             'promotions_history','creneaux','horaires','sous_periodes',
             'evaluations','evaluation_scores'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 1) PROFILES : on lit son propre profil ou (admin) ceux de son école.
CREATE POLICY t_profiles_select ON profiles FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole() AND (id = auth.uid() OR public.is_admin()));
CREATE POLICY t_profiles_write ON profiles FOR ALL TO authenticated
  USING (ecole_id = public.my_ecole() AND public.is_admin())
  WITH CHECK (ecole_id = public.my_ecole() AND public.is_admin());

-- 2) ECOLE : racine du locataire (la ligne dont id = my_ecole).
CREATE POLICY t_ecole_select ON ecole FOR SELECT TO authenticated
  USING (id = public.my_ecole());
CREATE POLICY t_ecole_write ON ecole FOR ALL TO authenticated
  USING (id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))
  WITH CHECK (id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()));

-- 3) Tables de configuration : lecture (école), écriture admin (bloquée si expiré).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['niveaux','sections','classes','branches','periodes',
                           'sous_periodes','creneaux','horaires','promotions_history'] LOOP
    EXECUTE format($f$CREATE POLICY t_%1$s_select ON %1$s FOR SELECT TO authenticated
      USING (ecole_id = public.my_ecole())$f$, t);
    EXECUTE format($f$CREATE POLICY t_%1$s_write ON %1$s FOR ALL TO authenticated
      USING (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))
      WITH CHECK (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))$f$, t);
  END LOOP;
END $$;

-- 4) ELEVES : école + (admin tout / enseignant ses classes) ; écriture admin.
CREATE POLICY t_eleves_select ON eleves FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole() AND (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids())));
CREATE POLICY t_eleves_write ON eleves FOR ALL TO authenticated
  USING (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))
  WITH CHECK (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()));

-- 5) ENSEIGNANT_BRANCHES : école + (admin / ses affectations) ; écriture admin.
CREATE POLICY t_affect_select ON enseignant_branches FOR SELECT TO authenticated
  USING (ecole_id = public.my_ecole() AND (public.is_admin() OR teacher_id = auth.uid()));
CREATE POLICY t_affect_write ON enseignant_branches FOR ALL TO authenticated
  USING (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()))
  WITH CHECK (ecole_id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole()));

-- 6) Carnet de cotes (école + admin/ses classes), lecture et écriture.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['notes','presences','appreciation','evaluations','evaluation_scores'] LOOP
    EXECUTE format($f$CREATE POLICY t_%1$s_select ON %1$s FOR SELECT TO authenticated
      USING (ecole_id = public.my_ecole() AND (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids())))$f$, t);
    EXECUTE format($f$CREATE POLICY t_%1$s_write ON %1$s FOR ALL TO authenticated
      USING (ecole_id = public.my_ecole() AND public.ecole_active(public.my_ecole()) AND (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids())))
      WITH CHECK (ecole_id = public.my_ecole() AND public.ecole_active(public.my_ecole()) AND (public.is_admin() OR classe_id IN (SELECT public.my_classe_ids())))$f$, t);
  END LOOP;
END $$;
