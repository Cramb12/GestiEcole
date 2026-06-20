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
