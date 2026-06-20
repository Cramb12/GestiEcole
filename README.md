# Système de Gestion Scolaire — RDC

Application complète de gestion scolaire pour les écoles de la République Démocratique du Congo (RDC), conforme à la structure du Ministère de l'Éducation Nationale et aux formats officiels de bulletins.

> **Langue de l'interface : Français** · Monnaie : Franc Congolais (FC)

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| Base de données | PostgreSQL (hébergée sur **Supabase**) |
| Authentification | JWT + bcrypt |
| Génération PDF | Puppeteer (Phase 6) |
| Déploiement | Railway / Render |

## Structure du projet

```
school-rdc/
├── client/      → Frontend React (interface en français)
├── server/      → API REST Node/Express + authentification JWT
└── database/    → Schéma SQL + scripts d'initialisation
```

## Avancement (par phases)

- [x] **Phase 1** — Fondations & Authentification *(en cours de validation)*
- [ ] Phase 2 — Configuration de l'école (Admin)
- [ ] Phase 3 — Gestion des élèves
- [ ] Phase 4 — Présences
- [ ] Phase 5 — Saisie des notes
- [ ] Phase 6 — Génération des bulletins
- [ ] Phase 7 — Rapports & Statistiques
- [ ] Phase 8 — Finitions & Déploiement

---

## Installation rapide (Phase 1)

### 1. Base de données (Supabase)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans le **SQL Editor**, exécutez le contenu de `database/schema.sql`.
3. Copiez votre **Connection string** (Project Settings → Database → Connection string → URI).

### 2. Backend (server)

```bash
cd server
cp .env.example .env        # puis collez votre DATABASE_URL Supabase + un JWT_SECRET
npm install
npm run seed                # crée l'école, les niveaux, 1 admin et 1 enseignant de test
npm run dev                 # démarre l'API sur http://localhost:5000
```

### 3. Frontend (client)

```bash
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # ouvre http://localhost:5173
```

### Comptes de test (après `npm run seed`)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | `directeur@ecole.cd` | `admin123` |
| Enseignant | `enseignant@ecole.cd` | `prof123` |

> ⚠️ Changez ces mots de passe avant toute mise en production.
