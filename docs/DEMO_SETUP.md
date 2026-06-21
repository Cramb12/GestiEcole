# Mettre en place l'école de DÉMONSTRATION

Objectif : un espace **dédié à la démonstration** (séparé de vos vraies écoles)
avec une fausse école complète — élèves, enseignants, matières officielles,
notes calculées, **bulletins remplis**, présences. Idéal pour convaincre un
directeur en 2 minutes.

> Recommandé : un **projet Supabase dédié** « gestiecole-demo » (gratuit jusqu'à
> 2 projets par organisation). Évite de mélanger la démo avec vos données.

## Étapes

1. **Créer le projet Supabase** de démo (voir `DEPLOY_NEW_SCHOOL.md`, étapes 1–3) :
   - exécuter `database/setup_complet.sql`
   - déployer la fonction `create-teacher`

2. **Compte admin** + données de démo :
   ```bash
   cd scripts
   cp .env.example .env        # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY du projet DEMO
   npm install
   npm run seed                # crée l'admin directeur@ecole.cd / admin123
   npm run seed:demo           # remplit l'école de démo (élèves, notes, bulletins…)
   ```

3. **Déployer un Vercel** pointant sur ce projet démo (Root Directory `client`,
   variables `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` du projet démo).

## Ce que la démo contient

- École « Institut de la Réussite » (Bukavu, Sud-Kivu), année 2025-2026.
- 2 classes représentatives :
  - **3ème A** (primaire — bulletin trimestriel)
  - **1ère Humanités Scientifique** (secondaire — bulletin semestriel)
- ~30 élèves (noms réalistes), 5 enseignants (`demo.*@ecole.cd` / `demo2025`).
- Matières **officielles** par programme, périodes + sous-périodes.
- **Évaluations + notes calculées** → les **bulletins sont remplis** et le
  **classement** fonctionne.
- Quelques **présences** (absences/retards) pour les rapports.

## Parcours de démonstration suggéré (2 min)

1. **Bulletins** → choisir « 1ère Hum. Scientifique » → **Aperçu** d'un élève →
   montrer le bulletin officiel rempli → **Imprimer / PDF**.
2. **Rapports** → vue classe → classement + matières en échec + élèves à risque.
3. **Notes** (compte enseignant `demo.kalala@ecole.cd`) → montrer le **carnet de
   cotes** et le calcul automatique.
4. **Élèves** → recherche, profil, import CSV.

> Argument clé : « Le bulletin officiel sort tout seul, sans calcul manuel. »
