-- Migration 004 — année (niveau d'études) de la classe.
-- Permet de relier une classe à ses cours (surtout au secondaire : les cours
-- des humanités dépendent de la section ET de l'année).
ALTER TABLE classes ADD COLUMN IF NOT EXISTS annee VARCHAR(10);  -- '1'..'8' ou NULL
