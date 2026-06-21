# Déployer une nouvelle école (pas à pas)

Ce guide explique comment mettre en service l'application pour **une école**.
Modèle « un espace par école » : chaque école a son **projet Supabase** et son
**déploiement Vercel** (données totalement isolées). Compter ~15–20 minutes.

---

## 1. Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**.
2. Noter le **mot de passe** de la base (généré à la création).
3. Une fois le projet prêt, ouvrir **Project Settings → API** et noter :
   - **Project URL** (ex. `https://xxxx.supabase.co`)
   - clé **anon** (publique)
   - clé **service_role** (secrète — ne jamais exposer côté frontend)

## 2. Créer la base de données (1 clic)

1. Supabase → **SQL Editor** → **New query**.
2. Coller **tout** le contenu de `database/setup_complet.sql`.
3. **Run**. (Crée toutes les tables, la sécurité RLS, le bucket logo, les
   créneaux par défaut.)

## 3. Déployer la fonction de création des enseignants

1. Supabase → **Edge Functions** → **Deploy a new function**.
2. Nom exact : **`create-teacher`**.
3. Coller le contenu de `supabase/functions/create-teacher/index.ts` → **Deploy**.
   *(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.)*

## 4. Créer le compte administrateur (+ données de test)

```bash
cd scripts
cp .env.example .env       # coller SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run seed
```

Crée l'école, les 5 niveaux, un **compte directeur** (`directeur@ecole.cd` /
`admin123`) et un enseignant de test. **Changez le mot de passe ensuite.**

> Pour ne créer que l'admin (sans données de démo), adaptez `scripts/seed.js`.

## 5. Déployer le frontend sur Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importer le dépôt GitHub.
2. **Root Directory** → **`client`** ⚠️ (sinon erreur 404).
3. **Framework Preset** → Vite.
4. **Environment Variables** :
   | Nom | Valeur |
   |-----|--------|
   | `VITE_SUPABASE_URL` | l'URL du projet Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la clé **anon** |
5. **Deploy**.

## 6. Première connexion

- Ouvrir l'URL Vercel → se connecter avec `directeur@ecole.cd` / `admin123`.
- **Configuration de l'école** : nom, province, ville, code, logo, année scolaire.
- **Classes / Matières / Sections / Périodes** : utiliser les boutons
  « Pré-charger » pour démarrer vite.
- **Enseignants** : créer les comptes (ou import CSV).

---

## Mise à jour du code (toutes les écoles)

Le code est commun (un seul dépôt GitHub). Quand vous poussez une mise à jour,
**chaque déploiement Vercel se met à jour automatiquement** à partir de GitHub.
Si une mise à jour ajoute des colonnes/tables, exécuter la **migration**
correspondante (`database/migrations/00X_*.sql`) dans le SQL Editor de chaque
école.

## Sécurité — rappels

- Côté Vercel : **uniquement** `VITE_SUPABASE_ANON_KEY` (publique). Jamais la
  clé `service_role`.
- La clé `service_role` ne sert qu'en local (script de seed) et dans l'Edge
  Function (côté serveur).
- La séparation des données est garantie par la **RLS** + le fait que chaque
  école a sa propre base.
