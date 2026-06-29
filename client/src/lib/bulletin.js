// Builds all the data needed to render a student's bulletin.
import { supabase } from './supabase.js';
import { maxima, brancheApplies } from './notes.js';
import { feeSituation, feeApplies } from './frais.js';
import { fetchAll } from './db.js';

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

// Rank students by a raw obtained-score map {eleveId: score}. The maximum is the
// same for every student (same curriculum), so ranking by the obtained sum is
// equivalent to ranking by percentage. Ties share a place (two firsts -> 3rd).
function rankByScore(scoreMap) {
  const list = Object.entries(scoreMap).map(([id, v]) => ({ id, v }));
  list.sort((a, b) => b.v - a.v);
  const place = {};
  let lastV = null, lastPlace = 0;
  list.forEach((it, i) => {
    if (lastV === null || it.v !== lastV) { lastPlace = i + 1; lastV = it.v; }
    place[it.id] = lastPlace;
  });
  return { place, nbre: list.length };
}

// Each period has THREE proclamations (P1, P2, and the period total), each with
// its own class ranking. Plus the annual ranking, computed at year-end.
async function classStats(classeId, pers) {
  const periodeIds = pers.map((p) => p.id);
  const ids = periodeIds.length ? periodeIds : ['00000000-0000-0000-0000-000000000000'];
  // Paginate: a fully-graded class over several periods exceeds the 1000-row cap.
  const notes = await fetchAll(() => supabase
    .from('notes')
    .select('eleve_id, periode_id, points_journaliers_1, points_journaliers_2, points_obtenus')
    .eq('classe_id', classeId)
    .in('periode_id', ids)
    .order('id'));

  const per = {};                    // periodeId -> { p1, p2, tot: {eleve -> sum}, any }
  const annual = {};                 // eleveId -> sum of points_obtenus
  pers.forEach((p) => (per[p.id] = { p1: {}, p2: {}, tot: {}, any: false }));
  const add = (m, k, v) => { if (v != null) m[k] = (m[k] || 0) + Number(v); };
  (notes || []).forEach((n) => {
    const blk = per[n.periode_id];
    if (!blk) return;
    if (n.points_journaliers_1 != null || n.points_journaliers_2 != null || n.points_obtenus != null) blk.any = true;
    add(blk.p1, n.eleve_id, n.points_journaliers_1);
    add(blk.p2, n.eleve_id, n.points_journaliers_2);
    add(blk.tot, n.eleve_id, n.points_obtenus);
    add(annual, n.eleve_id, n.points_obtenus);
  });

  const perPeriode = {};
  pers.forEach((p) => {
    const b = per[p.id];
    perPeriode[p.id] = { p1: rankByScore(b.p1), p2: rankByScore(b.p2), tot: rankByScore(b.tot), hasData: b.any };
  });
  return { perPeriode, annual: rankByScore(annual) };
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
  const newAgg = () => ({ perPeriode: pers.map(() => ({ tj1: 0, tj2: 0, exam: 0, total: 0 })), M: 0, annuel: 0, max: 0 });
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
      curDom.sous.perPeriode[i].tj1 += Number(c.tj1) || 0;
      curDom.sous.perPeriode[i].tj2 += Number(c.tj2) || 0;
      curDom.sous.perPeriode[i].exam += Number(c.exam) || 0;
      curDom.sous.perPeriode[i].total += Number(c.total) || 0;
      totals.perPeriode[i].tj1 += Number(c.tj1) || 0;
      totals.perPeriode[i].tj2 += Number(c.tj2) || 0;
      totals.perPeriode[i].exam += Number(c.exam) || 0;
      totals.perPeriode[i].total += Number(c.total) || 0;
    });
    curDom.sous.M += M; totals.M += M;
    curDom.sous.annuel += annuel; curDom.sous.max += annuelMax;
    totals.annuel += annuel; totals.max += annuelMax;
  }

  // Per-period and annual class statistics. Each period yields a % for P1, P2,
  // the exam, and the period total, plus a place (rank) for P1, P2 and the total
  // (the three proclamations).
  const stats = await classStats(classe.id, pers);
  const Msum = totals.M;                 // sum of per-period maxima (M) over subjects
  const periodeStats = pers.map((p, i) => {
    const st = stats.perPeriode[p.id];
    const has = !!st?.hasData && Msum > 0;
    const agg = totals.perPeriode[i];
    const pctOf = (val, max) => (has && max > 0 ? (val / max) * 100 : null);
    return {
      id: p.id,
      nbre: st?.tot?.nbre || 0,
      pctP1: pctOf(agg.tj1, Msum),
      pctP2: pctOf(agg.tj2, Msum),
      pctExam: pctOf(agg.exam, 2 * Msum),
      pct: pctOf(agg.total, 4 * Msum),                          // period total %
      placeP1: has ? (st.p1.place[eleveId] || null) : null,
      placeP2: has ? (st.p2.place[eleveId] || null) : null,
      place: has ? (st.tot.place[eleveId] || null) : null,      // period total place
    };
  });

  // The annual total is only meaningful once every period has been graded.
  const allGraded = pers.length > 0 && pers.every((p) => stats.perPeriode[p.id]?.hasData);
  const pourcentage = allGraded && totals.max > 0 ? (totals.annuel / totals.max) * 100 : null;
  const place = allGraded ? (stats.annual.place[eleveId] || null) : null;
  const nbre = stats.annual.nbre;

  const { data: appr } = await supabase
    .from('appreciation')
    .select('*')
    .eq('eleve_id', eleveId)
    .order('created_at', { ascending: false });
  const appreciation = (appr && appr[0]) || null;

  // Payment standing (only when the school requires it for bulletins).
  let paiement = { exige: false, enRegle: true, resteUSD: 0 };
  if (ecole?.bulletin_exige_paiement) {
    const [{ data: fraisAll }, { data: reds }, { data: pays }] = await Promise.all([
      supabase.from('frais').select('*').eq('actif', true),
      supabase.from('frais_reductions').select('*').eq('eleve_id', eleveId),
      supabase.from('paiements').select('*').eq('eleve_id', eleveId).eq('annule', false),
    ]);
    const applicable = (fraisAll || []).filter((f) => feeApplies(f, classe.niveau_id));
    const sit = feeSituation(applicable, reds, pays, ecole.taux_fc_usd);
    paiement = { exige: true, enRegle: sit.totalResteUSD <= 0.01, resteUSD: sit.totalResteUSD };
  }

  return {
    ecole, eleve, classe, niveau, template, system,
    ref: REF[template] || '', titre: TITRE[template] || "BULLETIN DE L'ÉLÈVE",
    periodes: pers, domaines, totals, periodeStats, pourcentage,
    place, nbreEleves: nbre,
    appreciation, approuve: !!appreciation?.signe_directeur,
    paiement,
  };
}
