// Builds all the data needed to render a student's bulletin.
import { supabase } from './supabase.js';
import { maxima, brancheApplies } from './notes.js';

// Official form references per template.
export const REF = {
  elementaire: 'IGE/P.S/004',
  moyen: 'IGE/P.S/005',
  terminal: 'IGE/P.S/006',
  cteb: 'IGE/P.S/CO',
  humanites: 'IGE/PS/059',
};

export const TITRE = {
  elementaire: "BULLETIN DE L'ÉLÈVE — DEGRÉ ÉLÉMENTAIRE",
  moyen: "BULLETIN DE L'ÉLÈVE — DEGRÉ MOYEN",
  terminal: "BULLETIN DE L'ÉLÈVE — DEGRÉ TERMINAL",
  cteb: "BULLETIN DE L'ÉLÈVE — CYCLE D'ORIENTATION",
  humanites: "BULLETIN DE L'ÉLÈVE — HUMANITÉS",
};

// Load the applicable subjects for a class. Lenient on purpose: includes
// section-specific subjects AND generic ones (section null), so a class works
// whether subjects were loaded per-section or as generic level subjects.
async function loadCourses(classe) {
  let q = supabase.from('branches').select('*').eq('niveau_id', classe.niveau_id);
  if (classe.section_id) q = q.or(`section_id.eq.${classe.section_id},section_id.is.null`);
  else q = q.is('section_id', null);
  const { data } = await q.order('ordre').order('nom');
  return (data || []).filter((b) => brancheApplies(b.annee, classe.annee));
}

// Compute each active student's annual percentage to derive the place.
async function classRanking(classeId, periodeIds) {
  const { data: notes } = await supabase
    .from('notes')
    .select('eleve_id, points_obtenus, max_periode')
    .eq('classe_id', classeId)
    .in('periode_id', periodeIds);
  const agg = {};
  (notes || []).forEach((n) => {
    if (n.points_obtenus == null) return;
    (agg[n.eleve_id] = agg[n.eleve_id] || { obt: 0, max: 0 });
    agg[n.eleve_id].obt += Number(n.points_obtenus);
    agg[n.eleve_id].max += Number(n.max_periode) || 0;
  });
  const list = Object.entries(agg).map(([id, a]) => ({ id, pct: a.max > 0 ? (a.obt / a.max) * 100 : 0 }));
  list.sort((a, b) => b.pct - a.pct);
  const place = {};
  let lastPct = null, lastPlace = 0;
  list.forEach((it, i) => {
    if (lastPct === null || it.pct !== lastPct) { lastPlace = i + 1; lastPct = it.pct; }
    place[it.id] = lastPlace;
  });
  return { place, nbre: list.length };
}

export async function buildBulletin(eleveId) {
  const { data: eleve } = await supabase
    .from('eleves')
    .select('*, classes(id, nom, annee, niveau_id, section_id, niveaux(nom, bulletin_template, systeme_periodes, type), sections(nom))')
    .eq('id', eleveId)
    .maybeSingle();
  if (!eleve || !eleve.classes) return null;

  const classe = eleve.classes;
  const niveau = classe.niveaux;
  const template = niveau?.bulletin_template;
  const system = niveau?.systeme_periodes || 'trimestre';

  const [{ data: ecole }, { data: periodes }, courses] = await Promise.all([
    supabase.from('ecole').select('*').order('created_at').limit(1).maybeSingle(),
    supabase.from('periodes').select('*').eq('niveau_id', classe.niveau_id).order('numero'),
    loadCourses(classe),
  ]);
  const pers = periodes || [];
  const periodeIds = pers.map((p) => p.id);

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('eleve_id', eleveId)
    .in('periode_id', periodeIds.length ? periodeIds : ['00000000-0000-0000-0000-000000000000']);
  const noteOf = (brId, perId) => (notes || []).find((n) => n.branche_id === brId && n.periode_id === perId);

  // Safety net: include any subject the student actually has a note for, even
  // if the curriculum filter missed it (section/year data mismatch). This
  // guarantees every graded subject appears on the bulletin.
  const courseIds = new Set(courses.map((c) => c.id));
  const missingIds = [...new Set((notes || []).map((n) => n.branche_id))].filter((id) => !courseIds.has(id));
  if (missingIds.length) {
    const { data: extra } = await supabase.from('branches').select('*').in('id', missingIds);
    (extra || []).forEach((b) => courses.push(b));
    courses.sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom));
  }

  // Group courses by domaine. Track, per group and per period, the sum of
  // obtained exams and totals, plus the sum of per-period maxima (M), so the
  // bulletin can print the official Max / Examen / Total columns.
  const newAgg = () => ({ perPeriode: pers.map(() => ({ exam: 0, total: 0 })), M: 0, annuel: 0, max: 0 });
  const domaines = [];
  let curDom = null;
  const totals = newAgg();

  for (const b of courses) {
    const M = Number(b.max_points) || 0;
    const mx = maxima(M);
    const domNom = b.domaine || 'AUTRES';
    if (!curDom || curDom.nom !== domNom) {
      curDom = { nom: domNom, courses: [], sous: newAgg() };
      domaines.push(curDom);
    }
    const perPeriode = pers.map((p) => {
      const n = noteOf(b.id, p.id);
      return {
        tj1: n?.points_journaliers_1 ?? null,
        tj2: n?.points_journaliers_2 ?? null,
        exam: n?.points_examen ?? null,
        total: n?.points_obtenus ?? null,
      };
    });
    const annuel = perPeriode.reduce((s, c) => s + (Number(c.total) || 0), 0);
    const annuelMax = mx.total * pers.length;
    const row = { nom: b.nom, sous_domaine: b.sous_domaine, M, mx, perPeriode, annuel, annuelMax };
    curDom.courses.push(row);
    // accumulate obtained exam/total per period, plus M and annual.
    perPeriode.forEach((c, i) => {
      curDom.sous.perPeriode[i].exam += Number(c.exam) || 0;
      curDom.sous.perPeriode[i].total += Number(c.total) || 0;
      totals.perPeriode[i].exam += Number(c.exam) || 0;
      totals.perPeriode[i].total += Number(c.total) || 0;
    });
    curDom.sous.M += M; totals.M += M;
    curDom.sous.annuel += annuel; curDom.sous.max += annuelMax;
    totals.annuel += annuel; totals.max += annuelMax;
  }

  const pourcentage = totals.max > 0 ? (totals.annuel / totals.max) * 100 : null;
  const { place, nbre } = await classRanking(classe.id, periodeIds);

  const { data: appr } = await supabase
    .from('appreciation')
    .select('*')
    .eq('eleve_id', eleveId)
    .order('created_at', { ascending: false });
  const appreciation = (appr && appr[0]) || null;

  return {
    ecole, eleve, classe, niveau, template, system,
    ref: REF[template] || '', titre: TITRE[template] || "BULLETIN DE L'ÉLÈVE",
    periodes: pers, domaines, totals, pourcentage,
    place: place[eleveId] || null, nbreEleves: nbre,
    appreciation, approuve: !!appreciation?.signe_directeur,
  };
}
