-- =====================================================================
-- Migration 009 — Propriétaire de la plateforme (vendeur)
-- Un "platform owner" voit TOUTES les écoles et peut les activer / suspendre
-- (au-dessus du cloisonnement par école). Sert à l'écran vendeur où, après
-- paiement mobile money, on passe une école de "essai" à "actif".
-- =====================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_owner BOOLEAN NOT NULL DEFAULT false;

-- Vrai si l'utilisateur courant est propriétaire de la plateforme.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_owner = TRUE);
$$;

-- ECOLE : le propriétaire lit toutes les écoles et peut les gérer.
DROP POLICY IF EXISTS t_ecole_select ON ecole;
CREATE POLICY t_ecole_select ON ecole FOR SELECT TO authenticated
  USING (public.is_owner() OR id = public.my_ecole());
DROP POLICY IF EXISTS t_ecole_write ON ecole;
CREATE POLICY t_ecole_write ON ecole FOR ALL TO authenticated
  USING (public.is_owner() OR (id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole())))
  WITH CHECK (public.is_owner() OR (id = public.my_ecole() AND public.is_admin() AND public.ecole_active(public.my_ecole())));

-- PROFILES : on lit toujours son propre profil (corrige le propriétaire dont
-- ecole_id est nul) ; l'admin lit ceux de son école ; le propriétaire lit tout.
DROP POLICY IF EXISTS t_profiles_select ON profiles;
CREATE POLICY t_profiles_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner() OR (ecole_id = public.my_ecole() AND public.is_admin()));
