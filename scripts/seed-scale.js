// Scale/full-cycle test: a fictional 300-student school (isolated tenant).
// Creates classes, students, subjects, period-1 notes, fees and payments,
// then prints counts. Run: node seed-scale.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ANNEE = '2025-2026';
const { PROGRAMMES } = await import('../client/src/data/programmes.js');

const NOMS = ['Bisimwa', 'Cizungu', 'Mukendi', 'Kabongo', 'Mushagalusa', 'Bahati', 'Furaha', 'Neema', 'Aksanti', 'Mapendo', 'Lubunga', 'Kahindo', 'Bagula', 'Nshombo', 'Cikuru', 'Namegabe', 'Mugisho', 'Balagizi', 'Wabenga', 'Murhula', 'Byamungu', 'Chibalonza', 'Mwangaza', 'Riziki'];
const POST = ['Mugaruka', 'Kabeya', 'Ilunga', 'Ngandu', 'Mwendapeke', 'Nsimire', 'Kavira', 'Mapenzi', 'Balagizi', 'Kahasha', 'Wabiwa', 'Lukogho'];
const PRE = ['Patrick', 'Emmanuel', 'Daniel', 'Israel', 'Exauce', 'Esperance', 'Neema', 'Sarah', 'Divine', 'Rachel', 'Gradi', 'Elie', 'Grace', 'Merveille', 'David'];

let s = 777, permN = 1;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));

async function chunkInsert(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) { console.error(`insert ${table}:`, error.message); process.exit(1); }
  }
}

async function main() {
  const t0 = Date.now();
  console.log('Test de charge — école de 300 élèves…');

  // Clean any previous run
  const email = 'admin@ecole-test300.cd';
  const { data: list } = await db.auth.admin.listUsers();
  const old = list.users.find((u) => u.email === email);
  if (old) {
    const { data: p } = await db.from('profiles').select('ecole_id').eq('id', old.id).maybeSingle();
    if (p?.ecole_id) await db.from('ecole').delete().eq('id', p.ecole_id);
    await db.auth.admin.deleteUser(old.id);
  }

  // École + admin + standard structure
  const { data: ec } = await db.from('ecole').insert({ nom_ecole: 'École Test 300', province: 'Sud-Kivu', ville: 'Bukavu', annee_scolaire: ANNEE, statut: 'actif', taux_fc_usd: 2800 }).select('id').single();
  const eid = ec.id;
  const { data: u } = await db.auth.admin.createUser({ email, password: 'test300!', email_confirm: true });
  await db.from('profiles').insert({ id: u.user.id, nom: 'Directeur', postnom: 'Test300', email, role: 'super_admin', ecole_id: eid });
  await db.rpc('provision_school_structure', { eid });

  const { data: niveaux } = await db.from('niveaux').select('id, bulletin_template').eq('ecole_id', eid);
  const nivByTpl = Object.fromEntries(niveaux.map((n) => [n.bulletin_template, n.id]));
  const { data: periodes } = await db.from('periodes').select('id, niveau_id, numero').eq('ecole_id', eid);
  const per1 = (nivId) => periodes.find((p) => p.niveau_id === nivId && p.numero === 1)?.id;

  // Sections
  const { data: secs } = await db.from('sections').insert([{ nom: 'Scientifique', code: 'SCI', ecole_id: eid }, { nom: 'Littéraire', code: 'LIT', ecole_id: eid }]).select('id, nom');
  const secSci = secs.find((x) => x.nom === 'Scientifique').id;
  const secLit = secs.find((x) => x.nom === 'Littéraire').id;

  // Branches per niveau (from official programmes), section/annee null = apply to all
  const progFor = (tpl) => PROGRAMMES.find((p) => p.template === tpl && (tpl !== 'humanites' || (p.section === 'Scientifique' && p.annee === '1')));
  const branchesByNiv = {};
  for (const tpl of ['elementaire', 'moyen', 'terminal', 'cteb', 'humanites']) {
    const nivId = nivByTpl[tpl]; const prog = progFor(tpl);
    if (!nivId || !prog) continue;
    const rows = prog.courses.map((c, i) => ({ nom: c.nom, domaine: c.domaine || null, sous_domaine: c.sous || null, max_points: c.max || 10, niveau_id: nivId, section_id: null, annee: null, ecole_id: eid, ordre: i + 1 }));
    await chunkInsert('branches', rows);
    branchesByNiv[nivId] = (await db.from('branches').select('id, max_points').eq('niveau_id', nivId)).data;
  }

  // 12 classes, 25 students each = 300
  const classDefs = [
    ['1ère A', 'elementaire', '1', null], ['2ème A', 'elementaire', '2', null],
    ['3ème A', 'moyen', '3', null], ['4ème A', 'moyen', '4', null],
    ['5ème A', 'terminal', '5', null], ['6ème A', 'terminal', '6', null],
    ['7ème A', 'cteb', '7', null], ['8ème A', 'cteb', '8', null],
    ['1ère Hum. Sci', 'humanites', '1', secSci], ['2ème Hum. Sci', 'humanites', '2', secSci],
    ['1ère Hum. Litt', 'humanites', '1', secLit], ['2ème Hum. Litt', 'humanites', '2', secLit],
  ];
  const classRows = classDefs.map(([nom, tpl, annee, sec]) => ({ nom, niveau_id: nivByTpl[tpl], section_id: sec, annee, annee_scolaire: ANNEE, ecole_id: eid }));
  await chunkInsert('classes', classRows);
  const { data: classes } = await db.from('classes').select('id, nom, niveau_id').eq('ecole_id', eid);

  // 25 students per class
  const studentRows = [];
  for (const c of classes) {
    for (let k = 0; k < 25; k++) {
      const f = rnd() > 0.5;
      studentRows.push({ nom: pick(NOMS), postnom: pick(POST), prenom: pick(PRE), sexe: f ? 'F' : 'M', date_naissance: `20${ri(10, 16)}-0${ri(1, 9)}-${ri(10, 28)}`, lieu_naissance: pick(['Bukavu', 'Goma', 'Uvira']), numero_perm: `PROV-T3-${String(permN++).padStart(4, '0')}`, classe_id: c.id, ecole_id: eid, annee_scolaire: ANNEE, actif: true });
    }
  }
  await chunkInsert('eleves', studentRows);
  const { data: eleves } = await db.from('eleves').select('id, classe_id').eq('ecole_id', eid);
  const byClass = {}; eleves.forEach((e) => (byClass[e.classe_id] = byClass[e.classe_id] || []).push(e.id));

  // Notes (period 1) for every class
  const noteRows = [];
  for (const c of classes) {
    const brs = branchesByNiv[c.niveau_id] || [];
    const pid = per1(c.niveau_id);
    if (!pid) continue;
    for (const eid2 of byClass[c.id] || []) {
      const base = ri(45, 90);
      for (const br of brs) {
        const M = Number(br.max_points) || 10;
        const r2 = (x) => Math.round(x * 100) / 100;
        const p1 = r2((base + ri(-12, 12)) / 100 * M), p2 = r2((base + ri(-12, 12)) / 100 * M), ex = r2((base + ri(-12, 12)) / 100 * M * 2);
        noteRows.push({ eleve_id: eid2, branche_id: br.id, periode_id: pid, classe_id: c.id, ecole_id: eid, points_journaliers_1: p1, points_journaliers_2: p2, points_examen: ex, points_obtenus: r2(p1 + p2 + ex), max_periode: M * 4, annee_scolaire: ANNEE });
      }
    }
  }
  await chunkInsert('notes', noteRows, 1000);

  // Fees (global) + payments
  const { data: fr } = await db.from('frais').insert([
    { libelle: "Frais d'inscription", montant: 50, devise: 'USD', periodicite: 'unique', ecole_id: eid, annee_scolaire: ANNEE },
    { libelle: 'Minerval', montant: 120, devise: 'USD', periodicite: 'trimestre', ecole_id: eid, annee_scolaire: ANNEE },
    { libelle: "Frais d'examen", montant: 30, devise: 'USD', periodicite: 'annuel', ecole_id: eid, annee_scolaire: ANNEE },
  ]).select('id, libelle');
  const F = Object.fromEntries(fr.map((f) => [f.libelle.includes('inscription') ? 'insc' : f.libelle === 'Minerval' ? 'min' : 'exam', f.id]));
  const payRows = [];
  eleves.forEach((e, i) => {
    const x = i % 10;
    const add = (fid, tr, lab, mt, mode) => payRows.push({ ecole_id: eid, eleve_id: e.id, frais_id: fid, tranche: tr, tranche_label: lab, montant: mt, devise: 'USD', mode, percepteur_id: u.user.id, date_paiement: '2026-10-05' });
    if (x < 9) add(F.insc, 1, 'Année', 50, 'especes');
    if (x < 7) add(F.min, 1, '1er trimestre', 40, 'orange');
    if (x < 4) add(F.min, 2, '2ème trimestre', 40, 'airtel');
    if (x < 3) { add(F.min, 3, '3ème trimestre', 40, 'especes'); add(F.exam, 1, 'Année', 30, 'mpesa'); }
  });
  await chunkInsert('paiements', payRows, 1000);

  // Counts
  const cnt = async (t) => (await db.from(t).select('id', { count: 'exact', head: true }).eq('ecole_id', eid)).count;
  console.log('  classes  :', await cnt('classes'));
  console.log('  élèves   :', await cnt('eleves'));
  console.log('  matières :', await cnt('branches'));
  console.log('  notes    :', await cnt('notes'));
  console.log('  frais    :', await cnt('frais'));
  console.log('  paiements:', await cnt('paiements'));
  console.log(`\nÉcole de test prête en ${((Date.now() - t0) / 1000).toFixed(1)}s. Admin: ${email} / test300!`);
  console.log('ecole_id:', eid);
}
main().catch((e) => { console.error('Échec:', e.message || e); process.exit(1); });
