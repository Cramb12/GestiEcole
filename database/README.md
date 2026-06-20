# Base de données — Schéma

Ce dossier contient le schéma complet de la base de données PostgreSQL.

## Fichiers

- **`schema.sql`** — Crée **toutes** les tables du système (conçues dès la Phase 1 pour
  l'ensemble des 8 phases). À exécuter une seule fois dans le SQL Editor de Supabase.

## Tables (vue d'ensemble)

| Table | Rôle |
|-------|------|
| `users` | Comptes (super_admin / teacher) |
| `ecole` | Informations de l'école (un seul enregistrement) |
| `niveaux` | Niveaux scolaires (Élémentaire, Moyen, ... Humanités) |
| `classes` | Classes (ex: "1ère A") |
| `eleves` | Élèves inscrits |
| `branches` | Matières / cours par niveau |
| `enseignant_branches` | Affectations enseignant ↔ matière ↔ classe |
| `periodes` | Trimestres / Semestres |
| `notes` | Notes / cotes des élèves |
| `presences` | Présences (journalières ou par cours) |
| `appreciation` | Application, conduite, délibération |
| `promotions_history` | Historique des promotions / redoublements |

## Exécution

1. Ouvrez votre projet Supabase → **SQL Editor**.
2. Collez le contenu de `schema.sql`.
3. Cliquez sur **Run**.

Les tables utilisent `ON DELETE` adaptés et des index sur les colonnes les plus
fréquemment interrogées (`eleve_id`, `classe_id`, `periode_id`).
