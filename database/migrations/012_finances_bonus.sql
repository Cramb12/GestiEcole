-- =====================================================================
-- Migration 012 — Finances bonus (Phase 6)
--   - telephone parent/tuteur sur les élèves (pour les rappels WhatsApp)
--   - echeances (dates limites par tranche) sur les frais -> "en retard"
-- Non destructif.
-- =====================================================================

ALTER TABLE eleves ADD COLUMN IF NOT EXISTS telephone VARCHAR(30);

-- Map { "1": "2026-10-31", "2": "2027-01-15", ... } : date limite par tranche.
ALTER TABLE frais  ADD COLUMN IF NOT EXISTS echeances JSONB NOT NULL DEFAULT '{}'::jsonb;
