// Measures the scale-sensitive screens for the 300-student test school,
// under RLS (logged in as that school's director — the real path).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const { feeApplies, feeSituation } = await import('../client/src/lib/frais.js');

const URL = process.env.SUPABASE_URL;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXR1bWNqZndiamt2YnZvbG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDkyNTYsImV4cCI6MjA5NzUyNTI1Nn0.LG4oBPaYuFXL5hMayBPe4LOOz_P3USjseZcyxdQY-jw';
const c = createClient(URL, ANON, { auth: { persistSession: false } });
const ms = (t) => `${(performance.now() - t).toFixed(0)} ms`;

await c.auth.signInWithPassword({ email: 'admin@ecole-test300.cd', password: 'test300!' });
const { data: me } = await c.rpc('my_ecole');
const taux = 2800;

console.log('=== RAPPORTS FINANCES (page percepteur) — 300 élèves ===');
let t = performance.now();
const [e, f, p, r] = await Promise.all([
  c.from('eleves').select('id, nom, postnom, prenom, telephone, classe_id, classes(nom, niveau_id)').eq('actif', true).order('nom'),
  c.from('frais').select('*').eq('actif', true),
  c.from('paiements').select('*, frais(libelle)').eq('annule', false).order('date_paiement', { ascending: false }),
  c.from('frais_reductions').select('*'),
]);
console.log('  Requêtes (4 en parallèle) :', ms(t), `| élèves=${e.data.length} paiements=${p.data.length}`);

t = performance.now();
const redBy = {}, payBy = {};
(r.data || []).forEach((x) => (redBy[x.eleve_id] = redBy[x.eleve_id] || []).push(x));
(p.data || []).forEach((x) => (payBy[x.eleve_id] = payBy[x.eleve_id] || []).push(x));
let due = 0, paid = 0, reste = 0;
for (const el of e.data) {
  const niv = el.classes?.niveau_id || null;
  const appl = f.data.filter((fr) => feeApplies(fr, niv));
  const s = feeSituation(appl, redBy[el.id], payBy[el.id], taux);
  due += s.totalDueUSD; paid += s.totalPaidUSD; reste += s.totalResteUSD;
}
console.log('  Calcul soldes (300 élèves) :', ms(t));
console.log(`  Résultat: prospecté ${due.toFixed(0)}$  encaissé ${paid.toFixed(0)}$  reste ${reste.toFixed(0)}$  taux ${Math.round(paid / due * 100)}%`);

console.log('\n=== RAPPORT ÉCOLE (admin) — toutes les notes ===');
t = performance.now();
const allNotes = await c.from('notes').select('eleve_id, classe_id, points_obtenus, max_periode');
console.log('  Charger toutes les notes :', ms(t), `| lignes=${allNotes.data.length}`);

console.log('\n=== BULLETIN — un élève (+ classement de sa classe) ===');
const { data: oneClass } = await c.from('classes').select('id, niveau_id').limit(1).single();
const { data: stu } = await c.from('eleves').select('id').eq('classe_id', oneClass.id).limit(1).single();
t = performance.now();
await c.from('notes').select('*').eq('eleve_id', stu.id);
console.log("  Notes de l'élève :", ms(t));
t = performance.now();
const classNotes = await c.from('notes').select('eleve_id, periode_id, points_journaliers_1, points_journaliers_2, points_obtenus').eq('classe_id', oneClass.id);
console.log('  Notes de la classe (classement) :', ms(t), `| lignes=${classNotes.data.length}`);
t = performance.now();
await c.from('branches').select('*').eq('niveau_id', oneClass.niveau_id);
console.log('  Matières du niveau :', ms(t));

console.log('\n(my_ecole =', me, ')');
