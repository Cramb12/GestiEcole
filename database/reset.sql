-- =====================================================================
-- RESET — supprime toutes les tables applicatives (et l'ancienne table
-- "users") pour repartir proprement sur le schéma Supabase-only.
--
--  DESTRUCTIF : efface les données applicatives. Les comptes Supabase
-- Auth (auth.users) NE sont PAS touchés.
--
-- À exécuter dans le SQL Editor de Supabase, PUIS ré-exécuter schema.sql.
-- =====================================================================

DROP TABLE IF EXISTS promotions_history CASCADE;
DROP TABLE IF EXISTS appreciation        CASCADE;
DROP TABLE IF EXISTS presences           CASCADE;
DROP TABLE IF EXISTS notes               CASCADE;
DROP TABLE IF EXISTS periodes            CASCADE;
DROP TABLE IF EXISTS enseignant_branches CASCADE;
DROP TABLE IF EXISTS branches            CASCADE;
DROP TABLE IF EXISTS eleves              CASCADE;
DROP TABLE IF EXISTS classes             CASCADE;
DROP TABLE IF EXISTS niveaux             CASCADE;
DROP TABLE IF EXISTS ecole               CASCADE;
DROP TABLE IF EXISTS profiles            CASCADE;

-- Ancienne table de la version Express (si présente)
DROP TABLE IF EXISTS users               CASCADE;

-- Fonctions d'aide RLS (recréées par schema.sql)
DROP FUNCTION IF EXISTS public.is_admin()        CASCADE;
DROP FUNCTION IF EXISTS public.my_classe_ids()   CASCADE;
