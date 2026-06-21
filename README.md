# Système de Gestion Scolaire — RDC (GestiEcole)

Application complète de gestion scolaire pour les écoles de la **République Démocratique du Congo**, conforme à la structure du Ministère de l'Éducation Nationale et aux formats officiels de bulletins (MINEDUC).

> **Interface en français** · Monnaie : Franc Congolais (FC) · Hébergement **Vercel + Supabase** (gratuit)

## Fonctionnalités

| Module | Détail |
|--------|--------|
| **Authentification** | Connexion email/mot de passe (Supabase Auth), rôles Administrateur / Enseignant |
| **Configuration** | École + logo, niveaux, **sections d'humanités**, classes, **matières par programme officiel**, périodes (trimestres/semestres) |
| **Enseignants** | Comptes, affectations matière × classe (création manuelle ou **import CSV**) |
| **Élèves** | Inscription (N° PERM optionnel + provisoire), école de provenance, recherche/filtres, promotion/redoublement, **import CSV** |
| **Emploi du temps** | Grille Lun–Sam par classe, créneaux configurables, à partir des affectations |
| **Présences** | Appel journalier (primaire) et par cours (secondaire), résumés, calendrier |
| **Notes** | **Carnet de cotes** (devoirs/interrogations/examens) → calcul automatique P1/P2/Examen/Total ; verrouillage par proclamation |
| **Bulletins** | Modèles officiels en PDF (impression navigateur), filigrane PROVISOIRE, validation directeur |
| **Rapports** | Performance école/classe, taux d'échec par matière, élèves à risque, présences, exports CSV |

## Structure du projet

```
school-rdc/
├── client/      → Frontend React (Vite), interface en français
├── database/    → setup_complet.sql + schema.sql + migrations/ + storage.sql
├── supabase/    → functions/create-teacher (Edge Function)
├── scripts/     → seed.js (données de test)
└── samples/     → CSV d'exemple (élèves, enseignants)
```

## Architecture (Supabase-only)

- **Frontend React** hébergé sur **Vercel** ; parle directement à **Supabase**.
- **Supabase** : base PostgreSQL + Auth + sécurité **Row Level Security (RLS)** + Storage (logo).
- **1 Edge Function** (`create-teacher`) pour créer les comptes enseignants côté serveur (la clé `service_role` ne quitte jamais le serveur).
- Génération PDF côté navigateur (impression → Enregistrer en PDF).

---

## Installation (nouvelle école) — résumé

> Guide détaillé pas-à-pas : **`docs/DEPLOY_NEW_SCHOOL.md`**

1. **Supabase** : créer un projet → SQL Editor → exécuter **`database/setup_complet.sql`** (tout en un).
2. **Edge Function** : déployer `supabase/functions/create-teacher` (dashboard → Edge Functions).
3. **Seed** (optionnel, données de test + compte admin) :
   ```bash
   cd scripts && cp .env.example .env   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   npm install && npm run seed
   ```
4. **Vercel** : importer le dépôt, **Root Directory = `client`**, variables :
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. **Deploy**. C'est en ligne.

### Comptes de test (après seed)
| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | `directeur@ecole.cd` | `admin123` |
| Enseignant | `enseignant@ecole.cd` | `prof123` |

> Changez ces mots de passe en production.

## Développement local

```bash
cd client && cp .env.example .env   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install && npm run dev          # http://localhost:5173
```

## Avancement

- [x] Phase 1 — Fondations & Authentification
- [x] Phase 2 — Configuration de l'école
- [x] Phase 3 — Gestion des élèves
- [x] Phase 4 — Présences
- [x] Phase 5 — Notes (carnet de cotes + calcul automatique)
- [x] Phase 6 — Bulletins (format officiel)
- [x] Phase 7 — Rapports & statistiques
- [x] Phase 8 — Finitions & déploiement

### Modules additionnels
- [x] Sections d'humanités (28 sections officielles)
- [x] Emploi du temps
- [x] Import CSV (élèves, enseignants, affectations, horaire)
