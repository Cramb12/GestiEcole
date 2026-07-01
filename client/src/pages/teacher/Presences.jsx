// Teacher attendance (appel).
//  - Primary: daily, by the class titulaire (branche_id = null).
//  - Secondary: daily per course, by each subject teacher (branche_id set).
// Once submitted for a (class, [subject], date), it's locked (admin can override).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { saveDraft, loadDraft, clearDraft } from '../../lib/drafts.js';
import { enqueue, processOutbox } from '../../lib/outbox.js';
import { readThrough } from '../../lib/cache.js';
import { useOnline } from '../../hooks/useOnline.js';
import Layout from '../../components/Layout.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export default function Presences() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const navigate = useNavigate();

  const [contexts, setContexts] = useState([]);
  const [ctxKey, setCtxKey] = useState('');
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // eleve_id -> { statut, note }
  const [locked, setLocked] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [restored, setRestored] = useState(false);
  const online = useOnline();

  // Build the teacher's attendance contexts (primary classes + secondary courses).
  useEffect(() => {
    if (!user) return;
    async function loadContexts() {
      const { data } = await readThrough(`ctx:pres:${user.id}`, async () => {
        const [tit, aff] = await Promise.all([
          supabase.from('classes').select('id, nom, niveaux(type)').eq('titulaire_id', user.id),
          supabase
            .from('enseignant_branches')
            .select('id, branche_id, classe_id, branches(nom), classes(nom, niveaux(type))')
            .eq('teacher_id', user.id),
        ]);
        if (tit.error) throw tit.error;
        if (aff.error) throw aff.error;
        return { tit: tit.data || [], aff: aff.data || [] };
      });
      const d = data || { tit: [], aff: [] };
      const list = [];
      d.tit
        .filter((c) => c.niveaux?.type === 'primaire')
        .forEach((c) => list.push({ key: 'p-' + c.id, label: `${c.nom} — appel journalier`, classe_id: c.id, branche_id: null }));
      d.aff
        .filter((a) => a.classes?.niveaux?.type === 'secondaire')
        .forEach((a) => list.push({ key: 's-' + a.id, label: `${a.branches?.nom} — ${a.classes?.nom}`, classe_id: a.classe_id, branche_id: a.branche_id }));
      setContexts(list);
      if (list.length) setCtxKey(list[0].key);
      setLoadingCtx(false);
    }
    loadContexts();
  }, [user]);

  const ctx = useMemo(() => contexts.find((c) => c.key === ctxKey), [contexts, ctxKey]);
  const draftKey = ctx ? `presences:${ctx.key}:${date}` : null;

  // Load students + any existing attendance for the chosen context + date.
  useEffect(() => {
    if (!ctx || !date) return;
    async function loadDay() {
      setLoading(true);
      setMsg(null);
      const { data } = await readThrough(`pres:day:${ctx.classe_id}:${ctx.branche_id || 'null'}:${date}`, async () => {
        const els = await supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', ctx.classe_id).eq('actif', true).order('nom');
        if (els.error) throw els.error;
        let q = supabase.from('presences').select('*').eq('classe_id', ctx.classe_id).eq('date', date);
        q = ctx.branche_id ? q.eq('branche_id', ctx.branche_id) : q.is('branche_id', null);
        const existing = await q;
        if (existing.error) throw existing.error;
        return { els: els.data || [], existing: existing.data || [] };
      });
      const els = (data || {}).els || [];
      const existing = (data || {}).existing || [];
      setStudents(els);

      const m = {};
      if (existing && existing.length) {
        existing.forEach((p) => (m[p.eleve_id] = { statut: p.statut, note: p.note_absence || '' }));
        setLocked(true);
        setMarks(m);
        setRestored(false);
      } else {
        (els || []).forEach((e) => (m[e.id] = { statut: 'present', note: '' }));
        setLocked(false);
        // Restore an unsent local draft (offline-safe) over the defaults.
        const key = ctx ? `presences:${ctx.key}:${date}` : null;
        const d = key ? loadDraft(key) : null;
        if (d && typeof d === 'object') { setMarks(d); setRestored(true); }
        else { setMarks(m); setRestored(false); }
      }
      setLoading(false);
    }
    loadDay();
  }, [ctx, date]);

  function persist(next) { if (draftKey) saveDraft(draftKey, next); }
  function setStatut(eleveId, statut) {
    if (locked) return;
    setMarks((prev) => { const next = { ...prev, [eleveId]: { ...prev[eleveId], statut } }; persist(next); return next; });
  }
  function setNote(eleveId, note) {
    if (locked) return;
    setMarks((prev) => { const next = { ...prev, [eleveId]: { ...prev[eleveId], note } }; persist(next); return next; });
  }

  async function submit() {
    if (!ctx) return;
    setSaving(true);
    setMsg(null);
    const rows = students.map((e) => ({
      eleve_id: e.id,
      classe_id: ctx.classe_id,
      branche_id: ctx.branche_id,
      date,
      statut: marks[e.id]?.statut || 'present',
      note_absence: marks[e.id]?.statut === 'absent' ? marks[e.id]?.note || null : null,
      enseignant_id: user.id,
      annee_scolaire: ecole?.annee_scolaire || '',
    }));
    try {
      // Durably queue the appel (IndexedDB) then try to send now; if offline it
      // syncs automatically on reconnect.
      await enqueue('presences', { rows });
    } catch (e) {
      setSaving(false);
      setMsg({ type: 'error', text: "Impossible d'enregistrer sur l'appareil : " + (e?.message || e) });
      return;
    }
    if (draftKey) clearDraft(draftKey);
    setRestored(false);
    await processOutbox();
    setSaving(false);
    setLocked(true);
    setMsg({ type: 'success', text: online
      ? 'Appel enregistré et verrouillé pour la journée.'
      : "Appel enregistré sur l'appareil — envoi automatique dès le retour d'Internet." });
  }

  const counts = useMemo(() => {
    const v = { present: 0, absent: 0, retard: 0 };
    Object.values(marks).forEach((m) => { if (v[m.statut] != null) v[m.statut]++; });
    return v;
  }, [marks]);

  const fullName = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/enseignant')} style={{ marginBottom: 16 }}>
        ← Retour
      </button>
      <h1 className="admin-h1">Présences — Appel</h1>
      <p className="admin-sub">Marquez la présence de vos élèves. Une fois soumis, l'appel est verrouillé pour la journée.</p>

      {loadingCtx ? (
        <div className="empty-state">Chargement…</div>
      ) : contexts.length === 0 ? (
        <div className="empty-state">
          Vous n'avez pas de classe (titulaire) ni de cours assigné.<br />
          L'administrateur doit vous attribuer une classe ou des cours.
        </div>
      ) : (
        <>
          <div className="panel" style={{ padding: 14 }}>
            <div className="form-grid">
              <div>
                <label className="lbl">Classe / Cours</label>
                <select className="input" value={ctxKey} onChange={(e) => setCtxKey(e.target.value)}>
                  {contexts.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">Date</label>
                <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}
          {restored && !locked && <div className="locked-banner">Brouillon restauré : un appel non encore soumis a été retrouvé sur cet appareil.</div>}

          {loading ? (
            <div className="empty-state">Chargement de la liste…</div>
          ) : students.length === 0 ? (
            <div className="empty-state">Aucun élève actif dans cette classe.</div>
          ) : (
            <>
              {locked && <div className="locked-banner">Appel déjà effectué pour cette date — verrouillé. Contactez l'administrateur pour une correction.</div>}

              <div className="toolbar">
                <span className="pill pill-green">{counts.present} présent(s)</span>
                <span className="pill pill-red">{counts.absent} absent(s)</span>
                <span className="pill" style={{ background: '#fff5d6', color: '#9a6b00' }}>{counts.retard} retard(s)</span>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Élève</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {students.map((e) => {
                      const cur = marks[e.id]?.statut || 'present';
                      return (
                        <tr key={e.id}>
                          <td><strong>{fullName(e)}</strong></td>
                          <td>
                            <div className="att-actions">
                              {['present', 'absent', 'retard'].map((st) => (
                                <button
                                  key={st}
                                  className={`att-btn ${cur === st ? 'active ' + st : ''}`}
                                  onClick={() => setStatut(e.id, st)}
                                  disabled={locked}
                                >
                                  {st === 'present' ? 'Présent' : st === 'absent' ? 'Absent' : 'Retard'}
                                </button>
                              ))}
                            </div>
                            {cur === 'absent' && (
                              <input
                                className="note-input"
                                placeholder="Note (ex: certificat médical)"
                                value={marks[e.id]?.note || ''}
                                onChange={(ev) => setNote(e.id, ev.target.value)}
                                disabled={locked}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!locked && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={submit} disabled={saving}>
                    {saving ? 'Enregistrement…' : "Soumettre l'appel"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
