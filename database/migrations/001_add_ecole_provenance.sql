-- Migration 001 — ajoute l'école de provenance (pour les élèves transférés).
-- À exécuter dans le SQL Editor de Supabase (ou appliqué via l'API de gestion).
ALTER TABLE eleves
  ADD COLUMN IF NOT EXISTS ecole_provenance VARCHAR(200);
