// Rich DEMO seed — a complete fictional school for sales demos.
// Idempotent on names/emails (safe to re-run). Run with: npm run seed:demo
//   - 1 school (Bukavu), niveaux, sections
//   - classes (primary Moyen + secondary Humanités Scientifique)
//   - teachers (with logins), students with realistic names
//   - official subjects (from programmes.js), periods + sub-periods
//   - assignments, evaluations + scores -> computed notes (bulletins full)
//   - attendance + a bit of timetable
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ANNEE = '2025-2026';

const { PROGRAMMES } = await import('../client/src/data/programmes.js');

const NOMS = ['Bisimwa', 'Cizungu', 'Mukendi', 'Kabongo', 'Mushagalusa', 'Bahati', 'Furaha', 'Neema', 'Aksanti', 'Mapendo', 'Lubunga', 'Kahindo', 'Bagula', 'Nshombo', 'Cikuru', 'Namegabe', 'Mugisho', 'Balagizi', 'Wabenga', 'Murhula', 'Byamungu', 'Chibalonza', 'Mwangaza', 'Riziki'];
const POST = ['Mugaruka', 'Kabeya', 'Ilunga', 'Ngandu', 'Mwendapeke', 'Nsimire', 'Kavira', 'Mapenzi', 'Balagizi', 'Kahasha', 'Wabiwa', 'Lukogho'];
const PRE_M = ['Patrick', 'Emmanuel', 'Daniel', 'Israel', 'Exauce', 'Jonathan', 'Gradi', 'Elie', 'Christ', 'Josue', 'David', 'Pascal'];
const PRE_F = ['Esperance', 'Neema', 'Sarah', 'Divine', 'Rachel', 'Esther', 'Benedicte', 'Eunice', 'Faraja', 'Grace', 'Merveille', 'Aline'];

let s = 12345;
let permCounter = 1;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));

async function ensureUser(email, password, nom, postnom, role) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  let id;
  if (!error) id = data.user.id;
  else if (String(error.message).toLowerCase().includes('already')) {
    const { data: list } = await db.auth.admin.listUsers();
    id = list.users.find((u) => u.email === email)?.id;
  } else throw error;
  await db.from('profiles').upsert({ id, nom, postnom, email, role });
  return id;
}

async function getOrInsert(table, match, insert) {
  const { data } = await db.from(table).select('*').match(match).maybeSingle();
  if (data) return data;
  const { data: created } = await db.from(table).insert({ ...match, ...insert }).select('*').single();
  return created;
}

async function main() {
  console.log('Génération de l\'école de démonstration…');

  // École
  let { data: ecole } = await db.from('ecole').select('*').limit(1).maybeSingle();
  if (!ecole) {
    ecole = (await db.from('ecole').insert({ nom_ecole: 'Institut de la Réussite', province: 'Sud-Kivu', ville: 'Bukavu', commune: 'Ibanda', code_ecole: 'EP-2025', annee_scolaire: ANNEE }).select('*').single()).data;
  }
  console.log('  ✔ École');

  // Niveaux
  const niveauxDef = [['Élémentaire', 'primaire', 'trimestre', 'elementaire'], ['Moyen', 'primaire', 'trimestre', 'moyen'], ['Terminal', 'primaire', 'trimestre', 'terminal'], ["Cycle d'Orientation", 'secondaire', 'semestre', 'cteb'], ['Humanités', 'secondaire', 'semestre', 'humanites']];
  const niv = {};
  for (const [nom, type, sys, tpl] of niveauxDef) {
    const n = await getOrInsert('niveaux', { bulletin_template: tpl }, { nom, type, systeme_periodes: sys });
    niv[tpl] = n;
  }
  console.log('  ✔ Niveaux');

  // Section Scientifique
  const sci = await getOrInsert('sections', { nom: 'Scientifique' }, { code: 'SCI' });

  // Teachers
  const teachers = [];
  const tdef = [['Kalala', 'Mbuyi', 'demo.kalala@ecole.cd'], ['Nsimba', 'Lukau', 'demo.nsimba@ecole.cd'], ['Mushagalusa', 'Bahati', 'demo.mushagalusa@ecole.cd'], ['Furaha', 'Nabintu', 'demo.furaha@ecole.cd'], ['Bisimwa', 'Cikuru', 'demo.bisimwa@ecole.cd']];
  for (const [nom, postnom, email] of tdef) teachers.push({ id: await ensureUser(email, 'demo2025', nom, postnom, 'teacher'), nom, postnom });
  console.log('  ✔ Enseignants (mdp: demo2025)');

  // Classes : Moyen 3ème A (primaire) + 1ère Hum. Scientifique (secondaire)
  const classeMoyen = await getOrInsert('classes', { nom: '3ème A' }, { niveau_id: niv.moyen.id, annee: '3', annee_scolaire: ANNEE, titulaire_id: teachers[0].id });
  const classeSci = await getOrInsert('classes', { nom: '1ère Hum. Scientifique' }, { niveau_id: niv.humanites.id, section_id: sci.id, annee: '1', annee_scolaire: ANNEE, titulaire_id: teachers[1].id });

  // Matières depuis les programmes officiels
  async function loadMatieres(niveauId, sectionId, prog) {
    const { data: existing } = await db.from('branches').select('id, nom, max_points').eq('niveau_id', niveauId);
    if (existing && existing.length >= prog.courses.length) return existing;
    const rows = prog.courses.map((c, i) => ({ nom: c.nom, domaine: c.domaine || null, sous_domaine: c.sous || null, max_points: c.max, niveau_id: niveauId, section_id: sectionId, annee: prog.annee, ordre: i + 1 }));
    await db.from('branches').insert(rows);
    return (await db.from('branches').select('id, nom, max_points').eq('niveau_id', niveauId)).data;
  }
  const progMoyen = PROGRAMMES.find((p) => p.key === 'moyen');
  const progSci = PROGRAMMES.find((p) => p.template === 'humanites' && p.section === 'Scientifique' && p.annee === '1');
  const brMoyen = await loadMatieres(niv.moyen.id, null, progMoyen);
  const brSci = await loadMatieres(niv.humanites.id, sci.id, progSci);
  console.log(`  ✔ Matières (${brMoyen.length} primaire, ${brSci.length} secondaire)`);

  // Périodes + sous-périodes
  async function ensurePeriodes(niveau, sys) {
    const defs = sys === 'semestre' ? [['1er Semestre', 1], ['2ème Semestre', 2]] : [['1er Trimestre', 1], ['2ème Trimestre', 2], ['3ème Trimestre', 3]];
    const out = [];
    for (const [nom, numero] of defs) {
      const p = await getOrInsert('periodes', { niveau_id: niveau.id, numero }, { nom, type: sys, annee_scolaire: ANNEE });
      // sous-périodes
      const { data: sps } = await db.from('sous_periodes').select('numero').eq('periode_id', p.id);
      const have = new Set((sps || []).map((x) => x.numero));
      const toAdd = [[1, '2025-09-05', '2025-11-15'], [2, '2025-11-16', '2026-01-25']].filter(([n]) => !have.has(n)).map(([n, d, f]) => ({ periode_id: p.id, numero: n, date_debut: d, date_fin: f, statut: 'ouverte' }));
      if (toAdd.length) await db.from('sous_periodes').insert(toAdd);
      out.push(p);
    }
    return out;
  }
  const perMoyen = await ensurePeriodes(niv.moyen, 'trimestre');
  const perSci = await ensurePeriodes(niv.humanites, 'semestre');
  console.log('  ✔ Périodes + sous-périodes');

  // Élèves
  async function ensureStudents(classe, count, prefix) {
    const { count: ex } = await db.from('eleves').select('id', { count: 'exact', head: true }).eq('classe_id', classe.id);
    if (ex >= count) return (await db.from('eleves').select('id').eq('classe_id', classe.id).eq('actif', true)).data;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const f = rnd() > 0.5;
      rows.push({ nom: pick(NOMS), postnom: pick(POST), prenom: f ? pick(PRE_F) : pick(PRE_M), sexe: f ? 'F' : 'M', date_naissance: `${prefix}-0${ri(1, 9)}-${ri(10, 28)}`, lieu_naissance: pick(['Bukavu', 'Goma', 'Uvira', 'Kabare']), numero_perm: `PROV-${prefix}-${String(permCounter++).padStart(4, '0')}`, classe_id: classe.id, annee_scolaire: ANNEE });
    }
    await db.from('eleves').insert(rows);
    return (await db.from('eleves').select('id').eq('classe_id', classe.id).eq('actif', true)).data;
  }
  const elMoyen = await ensureStudents(classeMoyen, 14, '2016');
  const elSci = await ensureStudents(classeSci, 16, '2011');
  console.log(`  ✔ Élèves (${elMoyen.length} + ${elSci.length})`);

  // Affectations + évaluations + notes calculées
  async function gradeClass(classe, branches, periodes, students, brPerTeacher) {
    for (let bi = 0; bi < branches.length; bi++) {
      const br = branches[bi];
      const teacher = teachers[bi % teachers.length];
      await db.from('enseignant_branches').upsert({ teacher_id: teacher.id, branche_id: br.id, classe_id: classe.id, annee_scolaire: ANNEE }, { onConflict: 'teacher_id,branche_id,classe_id,annee_scolaire' });
      const M = Number(br.max_points) || 10;
      for (const per of periodes) {
        // skip if already has evaluations (idempotent re-run)
        const { count: hasEval } = await db.from('evaluations').select('id', { count: 'exact', head: true }).eq('classe_id', classe.id).eq('branche_id', br.id).eq('periode_id', per.id);
        if (hasEval > 0) continue;
        // evaluations: devoir+interro P1, devoir P2, examen
        const evs = [];
        const mk = async (type, sp, date, max) => {
          const { data } = await db.from('evaluations').insert({ classe_id: classe.id, branche_id: br.id, periode_id: per.id, type, sous_periode: sp, date, note_max: max, enseignant_id: teacher.id, annee_scolaire: ANNEE }).select('id').single();
          return { id: data.id, type, sous_periode: sp, note_max: max };
        };
        evs.push(await mk('devoir', 1, '2025-09-20', 10));
        evs.push(await mk('interrogation', 1, '2025-10-15', 20));
        evs.push(await mk('devoir', 2, '2025-12-05', 20));
        evs.push(await mk('examen', null, '2025-11-20', 80));
        // scores + computed notes
        const scoreRows = [], noteRows = [];
        for (const st of students) {
          const base = ri(50, 88); // student's general level
          const scoreOf = (max) => Math.round(Math.min(max, Math.max(0, (base + ri(-12, 12)) / 100 * max)));
          const sc = {};
          for (const ev of evs) { const v = scoreOf(ev.note_max); sc[ev.id] = v; scoreRows.push({ evaluation_id: ev.id, eleve_id: st.id, classe_id: classe.id, note: v }); }
          const avg = (list) => { const p = list.map((e) => sc[e.id] / e.note_max * 100); return p.length ? p.reduce((a, b) => a + b, 0) / p.length : null; };
          const a = avg(evs.filter((e) => e.type !== 'examen' && e.sous_periode === 1));
          const b = avg(evs.filter((e) => e.type !== 'examen' && e.sous_periode === 2));
          const c = avg(evs.filter((e) => e.type === 'examen'));
          const r2 = (x) => Math.round(x * 100) / 100;
          const P1 = r2(a / 100 * M), P2 = r2(b / 100 * M), EX = r2(c / 100 * M * 2);
          noteRows.push({ eleve_id: st.id, branche_id: br.id, periode_id: per.id, classe_id: classe.id, points_journaliers_1: P1, points_journaliers_2: P2, points_examen: EX, points_obtenus: r2(P1 + P2 + EX), max_periode: M * 4, annee_scolaire: ANNEE });
        }
        await db.from('evaluation_scores').upsert(scoreRows, { onConflict: 'evaluation_id,eleve_id' });
        await db.from('notes').upsert(noteRows, { onConflict: 'eleve_id,branche_id,periode_id' });
      }
    }
  }
  console.log('  … calcul des notes pour toutes les périodes (peut prendre ~1-2 min)');
  await gradeClass(classeMoyen, brMoyen, perMoyen, elMoyen);   // 3 trimestres
  await gradeClass(classeSci, brSci, perSci, elSci);           // 2 semestres
  console.log('  ✔ Affectations + évaluations + notes (toutes les périodes)');

  // Présences (quelques absences/retards)
  async function seedPresences(classe, students) {
    const { count } = await db.from('presences').select('id', { count: 'exact', head: true }).eq('classe_id', classe.id);
    if (count > 0) return;
    const rows = [];
    for (const d of ['2025-09-15', '2025-09-22', '2025-10-06', '2025-10-20']) {
      for (const st of students) {
        const r = rnd();
        rows.push({ eleve_id: st.id, classe_id: classe.id, branche_id: null, date: d, statut: r > 0.92 ? 'absent' : r > 0.85 ? 'retard' : 'present', enseignant_id: teachers[0].id, annee_scolaire: ANNEE });
      }
    }
    await db.from('presences').insert(rows);
  }
  await seedPresences(classeMoyen, elMoyen);
  await seedPresences(classeSci, elSci);
  console.log('  ✔ Présences');

  console.log('\n✅ École de démonstration prête !');
  console.log('   Admin : directeur@ecole.cd / admin123 (lancez d\'abord npm run seed si absent)');
  console.log('   Enseignants démo : demo.kalala@ecole.cd … / demo2025');
}

main().catch((e) => { console.error('Échec :', e.message || e); process.exit(1); });
