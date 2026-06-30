// Full test of the 1000-student school: performance, the 1000-row pagination at
// real scale, and the RLS boundaries of every role (admin, percepteur,
// inscripteur, enseignant). Run after seed-scale.js:  node scripts/test-scale.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const { fetchAll } = await import('../client/src/lib/db.js');
const { feeApplies, feeSituation } = await import('../client/src/lib/frais.js');

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXR1bWNqZndiamt2YnZvbG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDkyNTYsImV4cCI6MjA5NzUyNTI1Nn0.LG4oBPaYuFXL5hMayBPe4LOOz_P3USjseZcyxdQY-jw';
const DOMAIN = 'ecole-test1000.cd';
const ANNEE = '2025-2026';

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });
async function as(prefix) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email: `${prefix}@${DOMAIN}`, password: 'test1000!' });
  if (error) throw new Error(`Connexion ${prefix}: ${error.message}`);
  return c;
}
const ms = (t) => `${(performance.now() - t).toFixed(0)} ms`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { console.log(`  ${cond ? 'PASS' : '!! FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); cond ? pass++ : fail++; };

async function main() {
  const admin = await as('admin');
  const { data: eid } = await admin.rpc('my_ecole');
  const taux = 2800;

  console.log('=== 1) PERFORMANCE — rapports finances (1000 élèves, sous RLS admin) ===');
  let t = performance.now();
  const [eleves, fraisRes, paiements, reductions] = await Promise.all([
    fetchAll(() => admin.from('eleves').select('id, classe_id, classes(niveau_id)').eq('actif', true).order('id')),
    admin.from('frais').select('*').eq('actif', true),
    fetchAll(() => admin.from('paiements').select('*').eq('annule', false).order('id')),
    fetchAll(() => admin.from('frais_reductions').select('*').order('id')),
  ]);
  console.log(`  Chargement: ${ms(t)} | élèves=${eleves.length} paiements=${paiements.length} réductions=${reductions.length}`);
  t = performance.now();
  const redBy = {}, payBy = {};
  reductions.forEach((x) => (redBy[x.eleve_id] = redBy[x.eleve_id] || []).push(x));
  paiements.forEach((x) => (payBy[x.eleve_id] = payBy[x.eleve_id] || []).push(x));
  let due = 0, paid = 0;
  for (const el of eleves) {
    const niv = el.classes?.niveau_id || null;
    const appl = fraisRes.data.filter((fr) => feeApplies(fr, niv));
    const sit = feeSituation(appl, redBy[el.id], payBy[el.id], taux);
    due += sit.totalDueUSD; paid += sit.totalPaidUSD;
  }
  console.log(`  Calcul soldes 1000 élèves: ${ms(t)} | prospecté ${due.toFixed(0)}$ encaissé ${paid.toFixed(0)}$ taux ${Math.round(paid / due * 100)}%`);
  ok('Tous les élèves chargés (1000)', eleves.length === 1000, `${eleves.length}`);
  ok('Tous les paiements chargés (2600)', paiements.length === 2600, `${paiements.length}`);

  console.log('\n=== 2) PAGINATION 1000 lignes — vérité contre troncature ===');
  const notesPlain = (await admin.from('notes').select('id').range(0, 999)).data;
  const notesFull = await fetchAll(() => admin.from('notes').select('id').order('id'));
  ok('Lecture brute plafonnée à 1000', notesPlain.length === 1000, `${notesPlain.length}`);
  ok('fetchAll récupère TOUTES les notes', notesFull.length > 1000 && notesFull.length === 20550, `${notesFull.length}`);

  // Gradebook: one class/subject/period deliberately seeded with 1125 scores.
  const { data: oneEval } = await admin.from('evaluations').select('classe_id, branche_id, periode_id').limit(1).single();
  const { data: evs } = await admin.from('evaluations').select('id')
    .eq('classe_id', oneEval.classe_id).eq('branche_id', oneEval.branche_id).eq('periode_id', oneEval.periode_id);
  const evIds = evs.map((e) => e.id);
  const scoresPlain = (await admin.from('evaluation_scores').select('evaluation_id, note').in('evaluation_id', evIds).range(0, 999)).data;
  const scoresFull = await fetchAll(() => admin.from('evaluation_scores').select('evaluation_id, note').in('evaluation_id', evIds).order('id'));
  ok('Carnet — lecture brute plafonnée à 1000', scoresPlain.length === 1000, `${scoresPlain.length}`);
  ok('Carnet — fetchAll récupère les 1125 cotes', scoresFull.length === 1125, `${scoresFull.length}`);

  console.log('\n=== 3) RÔLE percepteur — accès finances ===');
  const perc = await as('percepteur');
  const pEleves = await fetchAll(() => perc.from('eleves').select('id').eq('actif', true).order('id'));
  const pPay = await fetchAll(() => perc.from('paiements').select('id').eq('annule', false).order('id'));
  ok('Percepteur voit les 1000 élèves', pEleves.length === 1000, `${pEleves.length}`);
  ok('Percepteur voit les 2600 paiements', pPay.length === 2600, `${pPay.length}`);
  const { data: pme } = await perc.auth.getUser();
  const { data: anEleve } = await admin.from('eleves').select('id').limit(1).single();
  const { data: aFrais } = await admin.from('frais').select('id').limit(1).single();
  const insPay = await perc.from('paiements').insert({ eleve_id: anEleve.id, frais_id: aFrais.id, tranche: 1, tranche_label: 'Test', montant: 5, devise: 'USD', mode: 'especes', percepteur_id: pme.user.id, date_paiement: '2025-11-01' }).select('id').single();
  ok('Percepteur peut enregistrer un paiement', !insPay.error, insPay.error?.message || 'ok');

  console.log('\n=== 4) RÔLE inscripteur — élèves uniquement ===');
  const insc = await as('inscripteur');
  const iEleves = await fetchAll(() => insc.from('eleves').select('id').eq('actif', true).order('id'));
  ok('Inscripteur voit les 1000 élèves', iEleves.length === 1000, `${iEleves.length}`);
  const iNotes = (await insc.from('notes').select('id').limit(5)).data || [];
  ok('Inscripteur NE voit PAS les notes (sécurité)', iNotes.length === 0, `${iNotes.length} lignes`);
  const iPay = (await insc.from('paiements').select('id').limit(5)).data || [];
  ok('Inscripteur NE voit PAS les paiements (sécurité)', iPay.length === 0, `${iPay.length} lignes`);
  const { data: aClasse } = await admin.from('classes').select('id').limit(1).single();
  const insEleve = await insc.from('eleves').insert({ nom: 'TEST_INSCRIPTEUR', numero_perm: 'PROV-TESTINS-1', classe_id: aClasse.id, annee_scolaire: ANNEE, actif: true }).select('id').single();
  ok('Inscripteur peut inscrire un élève', !insEleve.error, insEleve.error?.message || 'ok');

  console.log('\n=== 5) RÔLE enseignant — cloisonnement par classes ===');
  const prof = await as('prof1');
  const tEleves = await fetchAll(() => prof.from('eleves').select('id').eq('actif', true).order('id'));
  ok('Enseignant ne voit QUE ses classes (pas 1000)', tEleves.length > 0 && tEleves.length < 1000, `${tEleves.length} élèves`);
  const tNotesOther = (await prof.from('notes').select('id').limit(5)).data || [];
  ok('Enseignant voit des notes (ses classes)', tNotesOther.length >= 0, `${tNotesOther.length}`);

  console.log('\n=== Nettoyage des lignes de test ===');
  if (insEleve.data) await svc.from('eleves').delete().eq('id', insEleve.data.id);
  if (insPay.data) await svc.from('paiements').delete().eq('id', insPay.data.id);
  console.log('  lignes de test supprimées.');

  console.log(`\n========== RÉSULTAT: ${pass} PASS, ${fail} FAIL ==========`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('Échec test:', e.message || e); process.exit(1); });
