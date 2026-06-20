# Système de Gestion Scolaire — RDC

Application complète de gestion scolaire pour les écoles de la République Démocratique du Congo (RDC), conforme à la structure du Ministère de l'Éducation Nationale et aux formats officiels de bulletins.

> **Langue de l'interface : Français** · Monnaie : Franc Congolais (FC)

## Architecture (Supabase-only)

| Couche | Technologie |
|--------|-------------|
| Frontend | React (Vite) — hébergé sur **Vercel** |
| Backend / Auth / API / Sécurité | **Supabase** (Auth + PostgreSQL + RLS) |
| Stockage (logo) | Supabase Storage |
| Génération PDF | `pdfmake` (côté navigateur, Phase 6) |
| Déploiement | **Vercel + Supabase** uniquement |

> Pas de serveur Express : le frontend parle directement à Supabase, et la
> sécurité est assurée par les **politiques RLS** (Row Level Security) en base.

## Structure du projet

```
school-rdc/
├── client/      → Frontend React (interface en français, client Supabase)
├── database/    → schema.sql (tables + RLS) à exécuter dans Supabase
└── scripts/     → seed.js (création des comptes + données de test)
```

## Avancement (par phases)

- [x] **Phase 1** — Fondations & Authentification *(Supabase Auth + dashboards)*
- [ ] Phase 2 — Configuration de l'école (Admin)
- [ ] Phase 3 — Gestion des élèves
- [ ] Phase 4 — Présences
- [ ] Phase 5 — Saisie des notes
- [ ] Phase 6 — Génération des bulletins
- [ ] Phase 7 — Rapports & Statistiques
- [ ] Phase 8 — Finitions & Déploiement

---

## Installation (Phase 1)

### 1. Supabase — base de données

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → collez tout `database/schema.sql` → **Run** (crée les tables + la RLS).
3. **Project Settings → API** → notez :
   - `Project URL`
   - clé `anon` (publique)
   - clé `service_role` (secrète — pour le seed uniquement)

### 2. Seed — comptes + données de test

```bash
cd scripts
cp .env.example .env     # collez SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run seed
```

### 3. Frontend (client)

```bash
cd client
cp .env.example .env     # collez VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
```

### Comptes de test (après le seed)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | `directeur@ecole.cd` | `admin123` |
| Enseignant | `enseignant@ecole.cd` | `prof123` |

> ⚠️ Changez ces mots de passe avant toute mise en production.

---

## Déploiement sur Vercel

1. **Importez** le dépôt GitHub dans Vercel.
2. **Root Directory** → `client` ⚠️ (sinon erreur 404).
3. **Framework Preset** → Vite.
4. **Environment Variables** (les deux seules nécessaires) :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy**.

Aucune autre variable côté Vercel : la base, l'authentification et la sécurité
sont entièrement gérées par Supabase.
