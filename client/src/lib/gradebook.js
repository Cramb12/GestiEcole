// Gradebook engine: turns individual evaluations into the bulletin cells
// (P1, P2, Examen, Total) and writes them into `notes`.
//   P1 = moyenne(%) des travaux journaliers de la 1ère période × M
//   P2 = moyenne(%) des travaux journaliers de la 2ème période × M
//   Examen = moyenne(%) des examens × 2M
//   Total = P1 + P2 + Examen   (sur 4M)
import { supabase } from './supabase.js';
import { maxima } from './notes.js';
import { fetchAll } from './db.js';

export const GRACE_DAYS = 5;

// Is a sub-period locked? auto = locked after date_fin + 5 days.
export function isLocked(sp) {
  if (!sp) return false;
  if (sp.statut === 'proclamee') return true;
  if (sp.statut === 'ouverte') return false;
  if (!sp.date_fin) return false;
  const fin = new Date(sp.date_fin + 'T23:59:59');
  fin.setDate(fin.getDate() + GRACE_DAYS);
  return new Date() > fin;
}

// Which sub-period (1 or 2) does a date fall into? Chronological split at P1's end.
export function resolveSousPeriode(dateStr, sousPeriodes) {
  const sp1 = sousPeriodes.find((s) => s.numero === 1);
  if (sp1 && sp1.date_fin) return dateStr <= sp1.date_fin ? 1 : 2;
  return 1;
}

const round2 = (x) => Math.round(x * 100) / 100;

// Recompute the aggregated notes for one (class, subject, period).
export async function recomputeNotes(classeId, brancheId, periode, M, anneeScolaire) {
  const mx = maxima(M); // { tj1:M, tj2:M, exam:2M, total:4M }
  const [{ data: evals }, { data: students }] = await Promise.all([
    supabase.from('evaluations').select('id, type, sous_periode, note_max')
      .eq('classe_id', classeId).eq('branche_id', brancheId).eq('periode_id', periode.id),
    supabase.from('eleves').select('id').eq('classe_id', classeId).eq('actif', true),
  ]);
  const evalList = evals || [];
  const evalIds = evalList.map((e) => e.id);
  let scores = [];
  if (evalIds.length) {
    // Paginate: students × evaluations can exceed the 1000-row cap — a truncated
    // read here would write WRONG aggregated grades.
    scores = await fetchAll(() => supabase.from('evaluation_scores').select('evaluation_id, eleve_id, note').in('evaluation_id', evalIds).order('id'));
  }
  const byEleve = {};
  scores.forEach((s) => { (byEleve[s.eleve_id] = byEleve[s.eleve_id] || {})[s.evaluation_id] = s.note; });

  const avgPct = (list, eleveId) => {
    const pcts = [];
    list.forEach((ev) => {
      const note = byEleve[eleveId]?.[ev.id];
      if (note != null && Number(ev.note_max) > 0) pcts.push((Number(note) / Number(ev.note_max)) * 100);
    });
    return pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  };

  const isTJ = (e) => e.type === 'devoir' || e.type === 'interrogation';
  const p1 = evalList.filter((e) => isTJ(e) && e.sous_periode === 1);
  const p2 = evalList.filter((e) => isTJ(e) && e.sous_periode === 2);
  const ex = evalList.filter((e) => e.type === 'examen');

  const rows = (students || []).map((st) => {
    const a = avgPct(p1, st.id), b = avgPct(p2, st.id), c = avgPct(ex, st.id);
    const P1 = a == null ? null : round2((a / 100) * mx.tj1);
    const P2 = b == null ? null : round2((b / 100) * mx.tj2);
    const EX = c == null ? null : round2((c / 100) * mx.exam);
    const any = P1 != null || P2 != null || EX != null;
    return {
      eleve_id: st.id, branche_id: brancheId, periode_id: periode.id, classe_id: classeId,
      points_journaliers_1: P1, points_journaliers_2: P2, points_examen: EX,
      points_obtenus: any ? round2((P1 || 0) + (P2 || 0) + (EX || 0)) : null,
      max_periode: mx.total, annee_scolaire: anneeScolaire,
    };
  });
  if (rows.length) await supabase.from('notes').upsert(rows, { onConflict: 'eleve_id,branche_id,periode_id' });
}
