// One-time seed for Supabase. Creates auth users (admin + teacher),
// their profiles, the school, the 5 levels, and a sample class/subjects.
// Uses the SERVICE ROLE key (bypasses RLS) — run locally only.
//
//   cd scripts && npm install && npm run seed
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ANNEE = '2025-2026';

// Creates (or reuses) an auth user and returns its id.
async function ensureUser(email, password) {
  // Try to create; if it already exists, look it up instead.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user.id;

  if (String(error.message).toLowerCase().includes('already')) {
    // Find the existing user by listing (first page is enough for seed).
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list.users.find((u) => u.email === email);
    if (found) return found.id;
  }
  throw error;
}

async function seed() {
  console.log('🌱 Initialisation des données de test...');

  // --- Comptes Auth ----------------------------------------------------
  const adminId = await ensureUser('directeur@ecole.cd', 'admin123');
  const profId = await ensureUser('enseignant@ecole.cd', 'prof123');
  console.log('  ✔ Comptes Auth créés/retrouvés');

  // --- Profils ---------------------------------------------------------
  await admin.from('profiles').upsert([
    { id: adminId, nom: 'Directeur', postnom: 'Général', email: 'directeur@ecole.cd', role: 'super_admin' },
    { id: profId, nom: 'Kamau', postnom: 'Jean', email: 'enseignant@ecole.cd', role: 'teacher' },
  ]);
  console.log('  ✔ Profils enregistrés');

  // --- École (une seule) ----------------------------------------------
  const { data: existingEcole } = await admin.from('ecole').select('id').limit(1).maybeSingle();
  let ecoleId = existingEcole?.id;
  if (!ecoleId) {
    const { data } = await admin
      .from('ecole')
      .insert({
        nom_ecole: 'Institut de la Réussite',
        province: 'Sud-Kivu',
        ville: 'Bukavu',
        commune: 'Ibanda',
        code_ecole: 'EP-0001',
        annee_scolaire: ANNEE,
      })
      .select('id')
      .single();
    ecoleId = data.id;
  }
  console.log('  ✔ École prête');

  // --- Niveaux (les 5 templates de bulletin) --------------------------
  const niveauxDef = [
    ['Élémentaire', 'primaire', 'trimestre', 'elementaire'],
    ['Moyen', 'primaire', 'trimestre', 'moyen'],
    ['Terminal', 'primaire', 'trimestre', 'terminal'],
    ['7ème CTEB', 'secondaire', 'semestre', 'cteb'],
    ['Humanités', 'secondaire', 'semestre', 'humanites'],
  ];
  const niveauIds = {};
  for (const [nom, type, sys, tpl] of niveauxDef) {
    const { data: ex } = await admin
      .from('niveaux')
      .select('id')
      .eq('bulletin_template', tpl)
      .maybeSingle();
    if (ex) {
      niveauIds[tpl] = ex.id;
    } else {
      const { data } = await admin
        .from('niveaux')
        .insert({ nom, type, systeme_periodes: sys, bulletin_template: tpl })
        .select('id')
        .single();
      niveauIds[tpl] = data.id;
    }
  }
  console.log('  ✔ 5 niveaux prêts');

  // --- 1 classe + 2 branches + 1 affectation (exemple) ----------------
  const { data: existingClasse } = await admin
    .from('classes')
    .select('id')
    .eq('nom', '1ère A')
    .maybeSingle();

  let classeId = existingClasse?.id;
  if (!classeId) {
    const { data } = await admin
      .from('classes')
      .insert({ nom: '1ère A', niveau_id: niveauIds.elementaire, annee_scolaire: ANNEE, titulaire_id: profId })
      .select('id')
      .single();
    classeId = data.id;

    const { data: b1 } = await admin
      .from('branches')
      .insert({ nom: 'Français', domaine: 'Domaine des Langues', max_points: 40, niveau_id: niveauIds.elementaire, ordre: 1 })
      .select('id')
      .single();
    await admin.from('branches').insert({
      nom: 'Mathématiques',
      domaine: 'Domaine des Mathématiques Sciences et Technologie',
      max_points: 40,
      niveau_id: niveauIds.elementaire,
      ordre: 2,
    });
    await admin.from('enseignant_branches').insert({
      teacher_id: profId,
      branche_id: b1.id,
      classe_id: classeId,
      annee_scolaire: ANNEE,
    });
  }
  console.log('  ✔ Classe, branches et affectation d\'exemple prêtes');

  console.log('\n✅ Données de test insérées avec succès !');
  console.log('\n   Comptes de connexion :');
  console.log('   • Super Admin  → directeur@ecole.cd / admin123');
  console.log('   • Enseignant   → enseignant@ecole.cd / prof123\n');
}

seed().catch((err) => {
  console.error('❌ Échec du seed :', err.message || err);
  process.exit(1);
});
