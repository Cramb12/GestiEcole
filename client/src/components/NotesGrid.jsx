// Mark-entry grid for one (class, subject, period).
// Columns: Élève | TJ 1ère P. (/M) | TJ 2ème P. (/M) | Examen (/2M) | Total (/4M) | Abs.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { maxima, totalObtenu } from '../lib/notes.js';

export default function NotesGrid({ classeId, branche, periode, anneeScolaire, canEdit, onSaved }) {
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // eleve_id -> {j1, j2, exam, absent}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const M = maxima(branche.max_points);
  const locked = !canEdit || periode.is_locked;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);
      const [els, notes] = await Promise.all([
        supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
        supabase.from('notes').select('*').eq('classe_id', classeId).eq('branche_id', branche.id).eq('periode_id', periode.id),
      ]);
      setStudents(els.data || []);
      const m = {};
      (els.data || []).forEach((e) => (m[e.id] = { j1: '', j2: '', exam: '', absent: false }));
      (notes.data || []).forEach((n) => {
        const absent = n.points_obtenus != null && Number(n.points_obtenus) === 0 &&
          n.points_journaliers_1 == null && n.points_journaliers_2 == null && n.points_examen == null;
        m[n.eleve_id] = {
          j1: n.points_journaliers_1 ?? '',
          j2: n.points_journaliers_2 ?? '',
          exam: n.points_examen ?? '',
          absent,
        };
      });
      setMarks(m);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, branche.id, periode.id]);

  function setField(id, field, value) {
    if (locked) return;
    setMarks((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  }
  function toggleAbsent(id) {
    if (locked) return;
    setMarks((p) => ({ ...p, [id]: { ...p[id], absent: !p[id].absent, j1: '', j2: '', exam: '' } }));
  }

  // Validate a field value against its max; returns clamped string or '' .
  function clamp(value, max) {
    if (value === '' || value == null) return '';
    let v = Number(value);
    if (Number.isNaN(v)) return '';
    if (v < 0) v = 0;
    if (v > max) v = max;
    return String(v);
  }

  function onKey(e, rowIndex, col) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = document.getElementById(`nf-${rowIndex + 1}-${col}`);
      if (next) next.focus();
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const rows = students.map((e) => {
      const m = marks[e.id] || {};
      if (m.absent) {
        return {
          eleve_id: e.id, branche_id: branche.id, periode_id: periode.id, classe_id: classeId,
          points_journaliers_1: null, points_journaliers_2: null, points_examen: null,
          points_obtenus: 0, max_periode: M.total, annee_scolaire: anneeScolaire,
        };
      }
      const j1 = m.j1 === '' ? null : Number(m.j1);
      const j2 = m.j2 === '' ? null : Number(m.j2);
      const ex = m.exam === '' ? null : Number(m.exam);
      const obtenus = totalObtenu({ j1, j2, exam: ex });
      const blank = j1 == null && j2 == null && ex == null;
      return {
        eleve_id: e.id, branche_id: branche.id, periode_id: periode.id, classe_id: classeId,
        points_journaliers_1: j1, points_journaliers_2: j2, points_examen: ex,
        points_obtenus: blank ? null : obtenus, max_periode: M.total, annee_scolaire: anneeScolaire,
      };
    });
    const { error } = await supabase.from('notes').upsert(rows, { onConflict: 'eleve_id,branche_id,periode_id' });
    setSaving(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'success', text: 'Notes enregistrées.' });
    onSaved && onSaved();
  }

  const summary = useMemo(() => {
    let graded = 0;
    students.forEach((e) => {
      const m = marks[e.id] || {};
      if (m.absent || m.j1 !== '' || m.j2 !== '' || m.exam !== '') graded++;
    });
    return graded;
  }, [students, marks]);

  const fullName = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

  if (loading) return <div className="empty-state">Chargement de la liste…</div>;
  if (students.length === 0) return <div className="empty-state">Aucun élève actif dans cette classe.</div>;

  return (
    <div>
      {periode.is_locked && <div className="locked-banner">Période verrouillée par l'administration — saisie en lecture seule.</div>}
      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      <div className="toolbar">
        <span className="pill pill-blue">Max/période : {M.total}</span>
        <span className="admin-sub" style={{ margin: 0 }}>TJ {M.tj1} + TJ {M.tj2} + Examen {M.exam}</span>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{summary}/{students.length} saisi(s)</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Élève</th>
              <th style={{ width: 100 }}>TJ 1ère P. /{M.tj1}</th>
              <th style={{ width: 100 }}>TJ 2ème P. /{M.tj2}</th>
              <th style={{ width: 100 }}>Examen /{M.exam}</th>
              <th style={{ width: 90 }}>Total /{M.total}</th>
              <th style={{ width: 60 }}>Abs.</th>
            </tr>
          </thead>
          <tbody>
            {students.map((e, i) => {
              const m = marks[e.id] || {};
              const tot = m.absent ? 0 : totalObtenu({ j1: m.j1, j2: m.j2, exam: m.exam });
              return (
                <tr key={e.id}>
                  <td><strong>{fullName(e)}</strong></td>
                  {['j1', 'j2', 'exam'].map((col, ci) => (
                    <td key={col}>
                      <input
                        id={`nf-${i}-${col}`}
                        className="input"
                        style={{ maxWidth: 80 }}
                        type="number" min="0" max={col === 'exam' ? M.exam : M.tj1}
                        value={m.absent ? '' : (m[col] ?? '')}
                        disabled={locked || m.absent}
                        onChange={(ev) => setField(e.id, col, clamp(ev.target.value, col === 'exam' ? M.exam : M.tj1))}
                        onKeyDown={(ev) => onKey(ev, i, col)}
                      />
                    </td>
                  ))}
                  <td><strong>{m.absent ? 'ABS' : tot}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={!!m.absent} disabled={locked} onChange={() => toggleAbsent(e.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer les notes'}
          </button>
        </div>
      )}
    </div>
  );
}
