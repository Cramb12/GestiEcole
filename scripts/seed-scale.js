// Scale / full-cycle test: a fictional 1000-student school (isolated tenant).
// Builds 40 classes, 3 sections, the official curriculum, ~30 teachers with
// assignments, a percepteur and a chargé des inscriptions, period-1 notes,
// fees + payments, and ONE deliberately oversized gradebook (>1000 scores in a
// single class/subject/period) to exercise the 1000-row pagination for real.
// Run: node scripts/seed-scale.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ANNEE = '2025-2026';
const DOMAIN = 'ecole-test1000.cd';
const { PROGRAMMES } = await import('../client/src/data/programmes.js');

const NOMS = ['Bisimwa', 'Cizungu', 'Mukendi', 'Kabongo', 'Mushagalusa', 'Bahati', 'Furaha', 'Neema', 'Aksanti', 'Mapendo', 'Lubunga', 'Kahindo', 'Bagula', 'Nshombo', 'Cikuru', 'Namegabe', 'Mugisho', 'Balagizi', 'Wabenga', 'Murhula', 'Byamungu', 'Chibalonza', 'Mwangaza', 'Riziki'];
const POST = ['Mugaruka', 'Kabeya', 'Ilunga', 'Ngandu', 'Mwendapeke', 'Nsimire', 'Kavira', 'Mapenzi', 'Balagizi', 'Kahasha', 'Wabiwa', 'Lukogho'];
const PRE = ['Patrick', 'Emmanuel', 'Daniel', 'Israel', 'Exauce', 'Esperance', 'Neema', 'Sarah', 'Divine', 'Rachel', 'Gradi', 'Elie', 'Grace', 'Merveille', 'David'];

let s = 1337, permN = 1;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const r2 = (x) => Math.round(x * 100) / 100;

async function chunkInsert(table, rows, size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) { console.error(`insert ${table}:`, error.message); process.exit(1); }
  }
}

async function main() {
  const t0 = Date.now();
  console.log('Test de charge — école de 1000 élèves…');

  // --- Clean any previous run (delete school + all its auth users) -----------
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const admin = list.users.find((u) => u.email === `admin@${DOMAIN}`);
  if (admin) {
    const { data: p } = await db.from('profiles').select('ecole_id').eq('id', admin.id).maybeSingle();
    if (p?.ecole_id) await db.from('ecole').delete().eq('id', p.ecole_id);
  }
  for (const u of list.users) if ((u.email || '').endsWith(`@${DOMAIN}`)) await db.auth.admin.deleteUser(u.id);

  // --- École + admin + standard structure ------------------------------------
  const { data: ec } = await db.from('ecole').insert({ nom_ecole: 'École Test 1000', province: 'Sud-Kivu', ville: 'Bukavu', annee_scolaire: ANNEE, statut: 'actif', taux_fc_usd: 2800 }).select('id').single();
  const eid = ec.id;
  const mkUser = async (email, role, nom) => {
    const { data: u, error } = await db.auth.admin.createUser({ email, password: 'test1000!', email_confirm: true });
    if (error) { console.error('createUser', email, error.message); process.exit(1); }
    await db.from('profiles').insert({ id: u.user.id, nom, postnom: 'Test', email, role, ecole_id: eid });
    return u.user.id;
  };
  await mkUser(`admin@${DOMAIN}`, 'super_admin', 'Directeur');
  const percepteurId = await mkUser(`percepteur@${DOMAIN}`, 'percepteur', 'Percepteur');
  await mkUser(`inscripteur@${DOMAIN}`, 'inscripteur', 'Inscripteur');
  await db.rpc('provision_school_structure', { eid });

  const { data: niveaux } = await db.from('niveaux').select('id, bulletin_template').eq('ecole_id', eid);
  const nivByTpl = Object.fromEntries(niveaux.map((n) => [n.bulletin_template, n.id]));
  const { data: periodes } = await db.from('periodes').select('id, niveau_id, numero').eq('ecole_id', eid);
  const per1 = (nivId) => periodes.find((p) => p.niveau_id === nivId && p.numero === 1)?.id;

  // --- Sections (3) ----------------------------------------------------------
  const { data: secs } = await db.from('sections').insert([
    { nom: 'Scientifique', code: 'SCI', ecole_id: eid },
    { nom: 'Littéraire', code: 'LIT', ecole_id: eid },
    { nom: 'Commerciale', code: 'COM', ecole_id: eid },
  ]).select('id, code');
  const secBy = Object.fromEntries(secs.map((x) => [x.code, x.id]));

  // --- Branches per niveau (official programmes) -----------------------------
  const progFor = (tpl) => PROGRAMMES.find((p) => p.template === tpl && (tpl !== 'humanites' || (p.section === 'Scientifique' && p.annee === '1')));
  const branchesByNiv = {};
  for (const tpl of ['elementaire', 'moyen', 'terminal', 'cteb', 'humanites']) {
    const nivId = nivByTpl[tpl]; const prog = progFor(tpl);
    if (!nivId || !prog) continue;
    const rows = prog.courses.map((c, i) => ({ nom: c.nom, domaine: c.domaine || null, sous_domaine: c.sous || null, max_points: c.max || 10, niveau_id: nivId, section_id: null, annee: null, ecole_id: eid, ordre: i + 1 }));
    await chunkInsert('branches', rows);
    branchesByNiv[nivId] = (await db.from('branches').select('id, max_points').eq('niveau_id', nivId)).data;
  }

  // --- 40 classes (= 1000 students at 25 each) -------------------------------
  const classDefs = [];
  const par = ['A', 'B', 'C'];
  // Primary + CTEB: 8 grades x 3 parallels = 24 classes (no section)
  [['elementaire', 1], ['elementaire', 2], ['moyen', 3], ['moyen', 4], ['terminal', 5], ['terminal', 6], ['cteb', 7], ['cteb', 8]]
    .forEach(([tpl, g]) => par.forEach((p) => classDefs.push({ nom: `${g}ème ${p}`, tpl, annee: String(g), sec: null })));
  // Humanités: 4 grades x 3 sections + 4 extra Sci 'B' = 16 classes
  [1, 2, 3, 4].forEach((g) => ['SCI', 'LIT', 'COM'].forEach((sc) => classDefs.push({ nom: `${g}ème Hum. ${sc} A`, tpl: 'humanites', annee: String(g), sec: secBy[sc] })));
  [1, 2, 3, 4].forEach((g) => classDefs.push({ nom: `${g}ème Hum. SCI B`, tpl: 'humanites', annee: String(g), sec: secBy.SCI }));

  const classRows = classDefs.map((c) => ({ nom: c.nom, niveau_id: nivByTpl[c.tpl], section_id: c.sec, annee: c.annee, annee_scolaire: ANNEE, ecole_id: eid }));
  await chunkInsert('classes', classRows);
  const { data: classes } = await db.from('classes').select('id, nom, niveau_id').eq('ecole_id', eid).order('nom');

  // --- 25 students per class -------------------------------------------------
  const studentRows = [];
  for (const c of classes) {
    for (let k = 0; k < 25; k++) {
      const f = rnd() > 0.5;
      studentRows.push({ nom: pick(NOMS), postnom: pick(POST), prenom: pick(PRE), sexe: f ? 'F' : 'M', date_naissance: `20${ri(10, 16)}-0${ri(1, 9)}-${ri(10, 28)}`, lieu_naissance: pick(['Bukavu', 'Goma', 'Uvira']), numero_perm: `PROV-T1K-${String(permN++).padStart(5, '0')}`, classe_id: c.id, ecole_id: eid, annee_scolaire: ANNEE, actif: true });
    }
  }
  await chunkInsert('eleves', studentRows);
  const { data: eleves } = await db.from('eleves').select('id, classe_id').eq('ecole_id', eid);
  const byClass = {}; eleves.forEach((e) => (byClass[e.classe_id] = byClass[e.classe_id] || []).push(e.id));

  // --- 30 teachers + assignments (each class -> one titulaire, all branches) --
  const NUM_TEACHERS = 30;
  const teacherIds = [];
  for (let i = 0; i < NUM_TEACHERS; i++) teacherIds.push(await mkUser(`prof${i + 1}@${DOMAIN}`, 'teacher', `Enseignant${i + 1}`));
  const affRows = [];
  classes.forEach((c, i) => {
    const tid = teacherIds[i % NUM_TEACHERS];
    for (const br of branchesByNiv[c.niveau_id] || []) affRows.push({ teacher_id: tid, classe_id: c.id, branche_id: br.id, annee_scolaire: ANNEE, ecole_id: eid });
  });
  await chunkInsert('enseignant_branches', affRows);

  // --- Notes (period 1, aggregated) for every class --------------------------
  const noteRows = [];
  for (const c of classes) {
    const brs = branchesByNiv[c.niveau_id] || [];
    const pid = per1(c.niveau_id);
    if (!pid) continue;
    for (const sid of byClass[c.id] || []) {
      const base = ri(45, 90);
      for (const br of brs) {
        const M = Number(br.max_points) || 10;
        const p1 = r2((base + ri(-12, 12)) / 100 * M), p2 = r2((base + ri(-12, 12)) / 100 * M), ex = r2((base + ri(-12, 12)) / 100 * M * 2);
        noteRows.push({ eleve_id: sid, branche_id: br.id, periode_id: pid, classe_id: c.id, ecole_id: eid, points_journaliers_1: p1, points_journaliers_2: p2, points_examen: ex, points_obtenus: r2(p1 + p2 + ex), max_periode: M * 4, annee_scolaire: ANNEE });
      }
    }
  }
  await chunkInsert('notes', noteRows);

  // --- Oversized gradebook: 1 class x 1 subject x 1 period with 45 evals ------
  // 25 students x 45 evaluations = 1125 scores > 1000 -> exercises pagination.
  const gc = classes[0];
  const gBr = (branchesByNiv[gc.niveau_id] || [])[0];
  const gPid = per1(gc.niveau_id);
  const evalRows = [];
  for (let e = 0; e < 45; e++) evalRows.push({ classe_id: gc.id, branche_id: gBr.id, periode_id: gPid, type: 'devoir', sous_periode: 1, date: '2025-10-' + String((e % 28) + 1).padStart(2, '0'), note_max: 10, annee_scolaire: ANNEE, ecole_id: eid });
  await chunkInsert('evaluations', evalRows);
  const { data: evals } = await db.from('evaluations').select('id').eq('classe_id', gc.id).eq('branche_id', gBr.id).eq('periode_id', gPid);
  const scoreRows = [];
  for (const ev of evals) for (const sid of byClass[gc.id] || []) scoreRows.push({ evaluation_id: ev.id, eleve_id: sid, classe_id: gc.id, ecole_id: eid, note: r2(ri(40, 100) / 10) });
  await chunkInsert('evaluation_scores', scoreRows);

  // --- Fees (global) + payments ----------------------------------------------
  const { data: fr } = await db.from('frais').insert([
    { libelle: "Frais d'inscription", montant: 50, devise: 'USD', periodicite: 'unique', ecole_id: eid, annee_scolaire: ANNEE },
    { libelle: 'Minerval', montant: 120, devise: 'USD', periodicite: 'trimestre', ecole_id: eid, annee_scolaire: ANNEE },
    { libelle: "Frais d'examen", montant: 30, devise: 'USD', periodicite: 'annuel', ecole_id: eid, annee_scolaire: ANNEE },
  ]).select('id, libelle');
  const F = Object.fromEntries(fr.map((f) => [f.libelle.includes('inscription') ? 'insc' : f.libelle === 'Minerval' ? 'min' : 'exam', f.id]));
  const payRows = [];
  eleves.forEach((e, i) => {
    const x = i % 10;
    const add = (fid, tr, lab, mt, mode) => payRows.push({ ecole_id: eid, eleve_id: e.id, frais_id: fid, tranche: tr, tranche_label: lab, montant: mt, devise: 'USD', mode, percepteur_id: percepteurId, date_paiement: '2025-10-05' });
    if (x < 9) add(F.insc, 1, 'Année', 50, 'especes');
    if (x < 7) add(F.min, 1, '1er trimestre', 40, 'orange');
    if (x < 4) add(F.min, 2, '2ème trimestre', 40, 'airtel');
    if (x < 3) { add(F.min, 3, '3ème trimestre', 40, 'especes'); add(F.exam, 1, 'Année', 30, 'mpesa'); }
  });
  await chunkInsert('paiements', payRows);

  // --- Counts ----------------------------------------------------------------
  const cnt = async (t) => (await db.from(t).select('id', { count: 'exact', head: true }).eq('ecole_id', eid)).count;
  console.log('  sections :', await cnt('sections'));
  console.log('  classes  :', await cnt('classes'));
  console.log('  élèves   :', await cnt('eleves'));
  console.log('  matières :', await cnt('branches'));
  console.log('  enseignants (profils):', (await db.from('profiles').select('id', { count: 'exact', head: true }).eq('ecole_id', eid).eq('role', 'teacher')).count);
  console.log('  affectations:', await cnt('enseignant_branches'));
  console.log('  notes    :', await cnt('notes'));
  console.log('  évaluations:', await cnt('evaluations'));
  console.log('  scores (carnet):', await cnt('evaluation_scores'));
  console.log('  frais    :', await cnt('frais'));
  console.log('  paiements:', await cnt('paiements'));
  console.log(`\nÉcole prête en ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  console.log('  Comptes: admin@/percepteur@/inscripteur@/prof1..30@' + DOMAIN + '  (mdp: test1000!)');
  console.log('  ecole_id:', eid);
}
main().catch((e) => { console.error('Échec:', e.message || e); process.exit(1); });
