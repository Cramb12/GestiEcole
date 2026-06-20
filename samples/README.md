# Données de test (CSV)

Fichiers d'exemple pour remplir rapidement l'application.

## `eleves.csv` — importable directement
23 élèves répartis sur des classes du primaire et des humanités.

**Comment l'importer :**
1. Connectez-vous en **administrateur**.
2. **Élèves** → bouton **Importer (CSV)** → choisissez `eleves.csv` → **Importer**.

Colonnes : `nom, postnom, prenom, sexe, date_naissance, lieu_naissance, numero_perm, ecole_provenance, classe, annee_scolaire`.

> ⚠️ La colonne **`classe`** doit correspondre **exactement** au nom d'une classe existante.
> Les noms utilisés ici (`1ère année`, `1ère Hum. Scientifique`, …) sont ceux du bouton
> « Pré-charger les classes standard ». Si vos classes ont d'autres noms, adaptez la colonne
> `classe` (l'import signale, ligne par ligne, les classes introuvables).
>
> `numero_perm` est laissé vide → un numéro **provisoire** est généré automatiquement.
> `ecole_provenance` n'est rempli que pour les élèves transférés.

## `enseignants.csv` — référence (pas d'import automatique)
Les comptes enseignants se créent **un par un** dans **Enseignants → Nouvel enseignant**
(la création d'un compte de connexion passe par la fonction sécurisée Supabase).

Colonnes : `nom, postnom, prenom, email, password` (+ `matiere`, `classe` à titre indicatif
pour savoir quelle affectation leur donner ensuite dans « Gérer les affectations »).

> Astuce : demandez à l'assistant de **créer ces comptes en masse** si vous ne voulez pas
> les saisir manuellement.
