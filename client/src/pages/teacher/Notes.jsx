// Teacher gradebook. The teacher records evaluations (devoir / interrogation
// / examen, date, /max) and the students' marks; the system computes the
// bulletin cells (P1, P2, Examen, Total) automatically.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { brancheApplies } from '../../lib/notes.js';
import { isLocked, resolveSousPeriode, recomputeNotes } from '../../lib/gradebook.js';
import { fetchAll } from '../../lib/db.js';
import Layout from '../../components/Layout.jsx';
import Modal from '../../components/Modal.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const TYPE_LABEL = { devoir: 'Devoir', interrogation: 'Interrogation', examen: 'Examen' };
const fullName = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

export default function Notes() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const annee = ecole?.annee_scolaire || '';
  const navigate = useNavigate();

  const [classMap, setClassMap] = useState({});
  const [classeId, setClasseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [brancheId, setBrancheId] = useState('');
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [loadingCtx, setLoadingCtx] = useState(true);

  const [sousPeriodes, setSousPeriodes] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [scoreCounts, setScoreCounts] = useState({});
  const [summary, setSummary] = useState([]);
  const [msg, setMsg] = useState(null);
  const [evalModal, setEvalModal] = useState(null);
  const [scoreModal, setScoreModal] = useState(null);

  // ---- Context (class -> course -> period), same logic as attendance -----
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tit, aff] = await Promise.all([
        supabase.from('classes').select('id, nom, annee, niveau_id, section_id, niveaux(type)').eq('titulaire_id', user.id),
        supabase.from('enseignant_branches').select('classe_id, classes(id, nom, annee, niveau_id, section_id, niveaux(type)), branches(id, nom, max_points)').eq('teacher_id', user.id),
      ]);
      const map = {};
      (tit.data || []).forEach((c) => { map[c.id] = map[c.id] || { classe: c, isPrimaryTit: c.niveaux?.type === 'primaire', assigned: [] }; });
      (aff.data || []).forEach((a) => { const c = a.classes; if (!c) return; map[c.id] = map[c.id] || { classe: c, isPrimaryTit: false, assigned: [] }; if (a.branches) map[c.id].assigned.push(a.branches); });
      setClassMap(map);
      const ids = Object.keys(map);
      if (ids.length) setClasseId(ids[0]);
      setLoadingCtx(false);
    })();
  }, [user]);

  const entry = classMap[classeId];

  useEffect(() => {
    if (!entry) { setCourses([]); setPeriodes([]); return; }
    (async () => {
      const c = entry.classe;
      const { data: per } = await supabase.from('periodes').select('*').eq('niveau_id', c.niveau_id).order('numero');
      setPeriodes(per || []);
      setPeriodeId(per && per.length ? per[0].id : '');
      if (entry.isPrimaryTit) {
        const { data: br } = await supabase.from('branches').select('id, nom, max_points, annee, section_id').eq('niveau_id', c.niveau_id).is('section_id', null).order('ordre').order('nom');
        const list = (br || []).filter((b) => brancheApplies(b.annee, c.annee));
        setCourses(list); setBrancheId(list.length ? list[0].id : '');
      } else {
        setCourses(entry.assigned); setBrancheId(entry.assigned.length ? entry.assigned[0].id : '');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  const branche = useMemo(() => courses.find((b) => b.id === brancheId), [courses, brancheId]);
  const periode = useMemo(() => periodes.find((p) => p.id === periodeId), [periodes, periodeId]);
  const M = Number(branche?.max_points) || 0;
  const classes = Object.values(classMap);

  const sp1 = sousPeriodes.find((s) => s.numero === 1);
  const sp2 = sousPeriodes.find((s) => s.numero === 2);
  const p1Locked = isLocked(sp1);
  const p2Locked = isLocked(sp2);

  // ---- Load the gradebook for the chosen (class, course, period) ---------
  async function loadGradebook() {
    if (!classeId || !brancheId || !periodeId) { setEvaluations([]); setSummary([]); return; }
    const [{ data: sps }, { data: evals }, { data: notes }] = await Promise.all([
      supabase.from('sous_periodes').select('*').eq('periode_id', periodeId).order('numero'),
      supabase.from('evaluations').select('*').eq('classe_id', classeId).eq('branche_id', brancheId).eq('periode_id', periodeId).order('date'),
      supabase.from('notes').select('eleve_id, points_journaliers_1, points_journaliers_2, points_examen, points_obtenus, max_periode, eleves(nom, postnom, prenom)').eq('classe_id', classeId).eq('branche_id', brancheId).eq('periode_id', periodeId),
    ]);
    setSousPeriodes(sps || []);
    setEvaluations(evals || []);
    const ids = (evals || []).map((e) => e.id);
    if (ids.length) {
      // Paginate: students × evaluations can exceed the 1000-row cap for a busy class.
      const sc = await fetchAll(() => supabase.from('evaluation_scores').select('evaluation_id, note').in('evaluation_id', ids).order('id'));
      const cnt = {}; sc.forEach((s) => { if (s.note != null) cnt[s.evaluation_id] = (cnt[s.evaluation_id] || 0) + 1; });
      setScoreCounts(cnt);
    } else setScoreCounts({});
    setSummary((notes || []).sort((a, b) => fullName(a.eleves).localeCompare(fullName(b.eleves))));
  }

  useEffect(() => { loadGradebook(); /* eslint-disable-next-line */ }, [classeId, brancheId, periodeId]);

  function openNewEval() {
    setMsg(null);
    setEvalModal({ type: 'devoir', date: today(), label: '', note_max: 10 });
  }

  async function saveEval() {
    const f = evalModal;
    if (!f.date) { setMsg({ type: 'error', text: 'La date est obligatoire.' }); return; }
    if (!f.note_max || Number(f.note_max) <= 0) { setMsg({ type: 'error', text: 'Le maximum doit être positif.' }); return; }
    // Determine sub-period + lock.
    let sousP = null;
    if (f.type === 'examen') {
      if (p2Locked) { setMsg({ type: 'error', text: 'Période close : impossible d\'ajouter un examen.' }); return; }
    } else {
      sousP = resolveSousPeriode(f.date, sousPeriodes);
      if ((sousP === 1 && p1Locked) || (sousP === 2 && p2Locked)) {
        setMsg({ type: 'error', text: `La ${sousP === 1 ? '1ère' : '2ème'} période est verrouillée pour cette date.` });
        return;
      }
    }
    const { error } = await supabase.from('evaluations').insert({
      classe_id: classeId, branche_id: brancheId, periode_id: periodeId, type: f.type,
      sous_periode: sousP, date: f.date, label: f.label.trim() || null, note_max: Number(f.note_max),
      enseignant_id: user.id, annee_scolaire: annee,
    });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setEvalModal(null);
    setMsg({ type: 'success', text: 'Évaluation créée.' });
    loadGradebook();
  }

  async function removeEval(ev) {
    if (!window.confirm('Supprimer cette évaluation et ses notes ?')) return;
    const { error } = await supabase.from('evaluations').delete().eq('id', ev.id);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    await recomputeNotes(classeId, brancheId, periode, M, annee);
    loadGradebook();
  }

  function evalLocked(ev) {
    if (ev.type === 'examen') return p2Locked;
    return ev.sous_periode === 1 ? p1Locked : p2Locked;
  }

  const groups = [
    { key: 'p1', titre: '1ère période — Travaux Journaliers', locked: p1Locked, items: evaluations.filter((e) => e.type !== 'examen' && e.sous_periode === 1) },
    { key: 'p2', titre: '2ème période — Travaux Journaliers', locked: p2Locked, items: evaluations.filter((e) => e.type !== 'examen' && e.sous_periode === 2) },
    { key: 'ex', titre: 'Examen', locked: p2Locked, items: evaluations.filter((e) => e.type === 'examen') },
  ];

  const datesManquantes = !sp1?.date_fin;

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/enseignant')} style={{ marginBottom: 16 }}>← Retour</button>
      <h1 className="admin-h1">Carnet de cotes</h1>
      <p className="admin-sub">Saisissez vos évaluations (devoirs, interrogations, examens). Le bulletin (P1, P2, Examen, Total) se calcule automatiquement par moyenne.</p>

      {loadingCtx ? (
        <div className="empty-state">Chargement…</div>
      ) : classes.length === 0 ? (
        <div className="empty-state">Vous n'avez ni classe (titulaire) ni cours assigné.</div>
      ) : (
        <>
          <div className="panel" style={{ padding: 14 }}>
            <div className="form-grid">
              <div>
                <label className="lbl">Classe</label>
                <select className="input" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
                  {classes.map((c) => <option key={c.classe.id} value={c.classe.id}>{c.classe.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">Cours</label>
                <select className="input" value={brancheId} onChange={(e) => setBrancheId(e.target.value)} disabled={!courses.length}>
                  {courses.length === 0 && <option value="">Aucun cours</option>}
                  {courses.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">Période</label>
                <select className="input" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)} disabled={!periodes.length}>
                  {periodes.length === 0 && <option value="">Aucune période</option>}
                  {periodes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            </div>
          </div>

          {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}
          {datesManquantes && branche && periode && (
            <div className="locked-banner">Les dates des sous-périodes ne sont pas configurées : tous les travaux iront en P1. Demandez à l'administration de les définir (Périodes → Sous-périodes).</div>
          )}

          {!branche || !periode ? (
            <div className="empty-state">{courses.length === 0 ? 'Aucun cours disponible.' : periodes.length === 0 ? "Aucune période définie." : 'Sélectionnez un cours et une période.'}</div>
          ) : (
            <>
              <div className="toolbar">
                <span className="pill pill-blue">Max/période : {M * 4}</span>
                <span className="admin-sub" style={{ margin: 0 }}>P1 /{M} · P2 /{M} · Examen /{M * 2}</span>
                <div className="spacer" />
                <button className="btn btn-primary btn-sm" onClick={openNewEval}>+ Nouvelle évaluation</button>
              </div>

              {groups.map((g) => (
                <div className="panel" key={g.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{g.titre}</h3>
                    {g.locked && <span className="pill pill-red">Verrouillée</span>}
                  </div>
                  {g.items.length === 0 ? (
                    <div className="admin-sub" style={{ margin: 0 }}>Aucune évaluation.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data">
                        <thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>/Max</th><th>Notes saisies</th><th></th></tr></thead>
                        <tbody>
                          {g.items.map((ev) => (
                            <tr key={ev.id}>
                              <td>{ev.date}</td>
                              <td>{TYPE_LABEL[ev.type]}</td>
                              <td>{ev.label || '—'}</td>
                              <td>{ev.note_max}</td>
                              <td>{scoreCounts[ev.id] || 0}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="btn btn-outline btn-sm" onClick={() => setScoreModal(ev)}>{evalLocked(ev) ? 'Voir' : 'Saisir'}</button>
                                  {!evalLocked(ev) && <button className="btn btn-danger btn-sm" onClick={() => removeEval(ev)}>Suppr.</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Computed result */}
              <div className="panel">
                <h3>Résultat calculé (ce qui ira au bulletin)</h3>
                {summary.length === 0 ? (
                  <div className="admin-sub" style={{ margin: 0 }}>Saisissez des notes pour voir le calcul.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Élève</th><th>P1 /{M}</th><th>P2 /{M}</th><th>Examen /{M * 2}</th><th>Total /{M * 4}</th></tr></thead>
                      <tbody>
                        {summary.map((n) => (
                          <tr key={n.eleve_id}>
                            <td><strong>{fullName(n.eleves)}</strong></td>
                            <td>{n.points_journaliers_1 ?? '—'}</td>
                            <td>{n.points_journaliers_2 ?? '—'}</td>
                            <td>{n.points_examen ?? '—'}</td>
                            <td><strong>{n.points_obtenus ?? '—'}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {evalModal && (
        <Modal
          title="Nouvelle évaluation"
          onClose={() => setEvalModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setEvalModal(null)}>Annuler</button><button className="btn btn-primary" onClick={saveEval}>Créer</button></>}
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Type</label>
              <select className="input" value={evalModal.type} onChange={(e) => setEvalModal({ ...evalModal, type: e.target.value })}>
                <option value="devoir">Devoir</option>
                <option value="interrogation">Interrogation</option>
                <option value="examen">Examen</option>
              </select>
            </div>
            <div>
              <label className="lbl">Date <span className="req">*</span></label>
              <input className="input" type="date" value={evalModal.date} onChange={(e) => setEvalModal({ ...evalModal, date: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Titre</label>
              <input className="input" placeholder="ex: Devoir n°1" value={evalModal.label} onChange={(e) => setEvalModal({ ...evalModal, label: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Noté sur (max) <span className="req">*</span></label>
              <input className="input" type="number" min="1" value={evalModal.note_max} onChange={(e) => setEvalModal({ ...evalModal, note_max: e.target.value })} />
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {evalModal.type === 'examen' ? "L'examen alimente la colonne Examen." : 'Le travail ira en P1 ou P2 selon sa date.'}
          </p>
        </Modal>
      )}

      {scoreModal && (
        <ScoreModal
          evaluation={scoreModal}
          classeId={classeId}
          locked={evalLocked(scoreModal)}
          onClose={() => setScoreModal(null)}
          onSaved={async () => { await recomputeNotes(classeId, brancheId, periode, M, annee); setScoreModal(null); loadGradebook(); }}
        />
      )}
    </Layout>
  );
}

// --- Score entry for one evaluation -----------------------------------
function ScoreModal({ evaluation, classeId, locked, onClose, onSaved }) {
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const [els, sc] = await Promise.all([
        supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
        supabase.from('evaluation_scores').select('eleve_id, note').eq('evaluation_id', evaluation.id),
      ]);
      setStudents(els.data || []);
      const m = {}; (sc.data || []).forEach((s) => (m[s.eleve_id] = s.note ?? '')); setMarks(m);
      setLoading(false);
    })();
  }, [evaluation.id, classeId]);

  function set(id, v) {
    if (locked) return;
    let x = v;
    if (x !== '') { let n = Number(x); if (Number.isNaN(n)) x = ''; else { if (n < 0) n = 0; if (n > Number(evaluation.note_max)) n = Number(evaluation.note_max); x = String(n); } }
    setMarks((p) => ({ ...p, [id]: x }));
  }

  async function save() {
    setSaving(true); setErr(null);
    const rows = students.map((e) => ({ evaluation_id: evaluation.id, eleve_id: e.id, classe_id: classeId, note: marks[e.id] === '' || marks[e.id] == null ? null : Number(marks[e.id]) }));
    const { error } = await supabase.from('evaluation_scores').upsert(rows, { onConflict: 'evaluation_id,eleve_id' });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <Modal
      title={`${TYPE_LABEL[evaluation.type]} — ${evaluation.label || evaluation.date} (/${evaluation.note_max})`}
      onClose={onClose}
      footer={locked ? <button className="btn btn-secondary" onClick={onClose}>Fermer</button> : <><button className="btn btn-secondary" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button></>}
    >
      {err && <div className="alert-error">{err}</div>}
      {locked && <div className="locked-banner">Période verrouillée — lecture seule.</div>}
      {loading ? <div className="empty-state">Chargement…</div> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Élève</th><th style={{ width: 110 }}>Note /{evaluation.note_max}</th></tr></thead>
            <tbody>
              {students.map((e) => (
                <tr key={e.id}>
                  <td><strong>{fullName(e)}</strong></td>
                  <td><input className="input" style={{ maxWidth: 90 }} type="number" min="0" max={evaluation.note_max} value={marks[e.id] ?? ''} disabled={locked} onChange={(ev) => set(e.id, ev.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
