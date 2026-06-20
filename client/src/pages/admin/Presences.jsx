// Admin attendance overview — monthly summary (with absence flags),
// calendar of days taken, and per-day detail with override (edit/delete).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const STATUTS = ['present', 'absent', 'retard'];
const label = (s) => (s === 'present' ? 'Présent' : s === 'absent' ? 'Absent' : 'Retard');

export default function Presences() {
  const { ecole } = useEcole();
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [mode, setMode] = useState('mois'); // 'mois' | 'jour'
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());
  const [seuil, setSeuil] = useState(5);

  const [students, setStudents] = useState([]);
  const [monthRows, setMonthRows] = useState([]);
  const [dayRows, setDayRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('classes').select('id, nom, niveaux(nom)').order('nom').then(({ data }) => {
      setClasses(data || []);
      if (data && data.length) setClasseId(data[0].id);
    });
  }, []);

  // Monthly aggregation.
  useEffect(() => {
    if (!classeId || mode !== 'mois') return;
    async function load() {
      setLoading(true);
      const [y, m] = month.split('-').map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      const [els, pr] = await Promise.all([
        supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
        supabase.from('presences').select('eleve_id, date, statut').eq('classe_id', classeId).gte('date', `${month}-01`).lt('date', `${next}-01`),
      ]);
      setStudents(els.data || []);
      setMonthRows(pr.data || []);
      setLoading(false);
    }
    load();
  }, [classeId, month, mode]);

  // Day detail.
  useEffect(() => {
    if (!classeId || mode !== 'jour') return;
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, date, mode]);

  async function loadDay() {
    setLoading(true);
    const { data } = await supabase
      .from('presences')
      .select('id, eleve_id, branche_id, statut, note_absence, eleves(nom, postnom, prenom), branches(nom)')
      .eq('classe_id', classeId)
      .eq('date', date)
      .order('id');
    setDayRows(data || []);
    setLoading(false);
  }

  // Per-student monthly counts.
  const summary = useMemo(() => {
    const map = {};
    students.forEach((e) => (map[e.id] = { present: 0, absent: 0, retard: 0 }));
    monthRows.forEach((p) => {
      if (map[p.eleve_id] && map[p.eleve_id][p.statut] != null) map[p.eleve_id][p.statut]++;
    });
    return map;
  }, [students, monthRows]);

  // Days of the month that have attendance (for the calendar).
  const daysTaken = useMemo(() => {
    const set = new Set();
    monthRows.forEach((p) => set.add(Number(p.date.slice(8, 10))));
    return set;
  }, [monthRows]);

  async function changeStatut(row, statut) {
    const { error } = await supabase.from('presences').update({ statut }).eq('id', row.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else loadDay();
  }

  async function deleteDay() {
    if (!window.confirm("Supprimer tout l'appel de ce jour pour cette classe ? L'enseignant pourra le refaire.")) return;
    const { error } = await supabase.from('presences').delete().eq('classe_id', classeId).eq('date', date);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Appel du jour supprimé.' });
      loadDay();
    }
  }

  const fullName = (e) => `${e?.nom || ''} ${e?.postnom || ''} ${e?.prenom || ''}`.replace(/\s+/g, ' ').trim();

  return (
    <AdminLayout title="Présences" subtitle="Suivi des présences par classe : résumé mensuel, calendrier et détail journalier." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" style={{ minWidth: 200 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div>
          <label className="lbl">Vue</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="mois">Résumé mensuel</option>
            <option value="jour">Détail journalier</option>
          </select>
        </div>
        {mode === 'mois' ? (
          <>
            <div>
              <label className="lbl">Mois</label>
              <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Seuil d'alerte (absences)</label>
              <input className="input" type="number" min="1" style={{ width: 90 }} value={seuil} onChange={(e) => setSeuil(Number(e.target.value) || 1)} />
            </div>
          </>
        ) : (
          <div>
            <label className="lbl">Date</label>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : mode === 'mois' ? (
        <>
          <div className="panel">
            <h3>Calendrier — jours d'appel ({month})</h3>
            <Calendar month={month} daysTaken={daysTaken} />
          </div>

          {students.length === 0 ? (
            <div className="empty-state">Aucun élève actif dans cette classe.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Élève</th><th>Présences</th><th>Absences</th><th>Retards</th><th>Alerte</th></tr>
                </thead>
                <tbody>
                  {students.map((e) => {
                    const s = summary[e.id] || { present: 0, absent: 0, retard: 0 };
                    const flag = s.absent >= seuil;
                    return (
                      <tr key={e.id}>
                        <td><strong>{fullName(e)}</strong></td>
                        <td>{s.present}</td>
                        <td>{s.absent}</td>
                        <td>{s.retard}</td>
                        <td>{flag ? <span className="pill pill-red">Absences élevées</span> : <span className="pill pill-green">OK</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {dayRows.length === 0 ? (
            <div className="empty-state">Aucun appel enregistré pour cette classe à cette date.</div>
          ) : (
            <>
              <div className="toolbar">
                <div className="spacer" />
                <button className="btn btn-danger btn-sm" onClick={deleteDay}>Supprimer l'appel du jour</button>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Élève</th><th>Cours</th><th>Statut (modifiable)</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {dayRows.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{fullName(r.eleves)}</strong></td>
                        <td>{r.branches?.nom || 'Journalier'}</td>
                        <td>
                          <select className="input" style={{ maxWidth: 140 }} value={r.statut} onChange={(e) => changeStatut(r, e.target.value)}>
                            {STATUTS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </select>
                        </td>
                        <td>{r.note_absence || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// Simple month calendar highlighting days that have attendance.
function Calendar({ month, daysTaken }) {
  const [y, m] = month.split('-').map(Number);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cal">
      {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((h) => <div key={h} className="cal-h">{h}</div>)}
      {cells.map((d, i) => (
        <div key={i} className={'cal-day ' + (d == null ? 'blank' : daysTaken.has(d) ? 'has' : '')}>
          {d || ''}
        </div>
      ))}
    </div>
  );
}
