// Reports & analytics (admin). Two views:
//  - École: class ranking by average %, school average.
//  - Classe: student ranking, subject failure rate, at-risk students,
//    attendance summary — for a class + period. CSV export everywhere.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { downloadCSV } from '../../lib/csv.js';
import { fetchAll } from '../../lib/db.js';
import AdminLayout from '../../components/AdminLayout.jsx';

const fullName = (e) => `${e?.nom || ''} ${e?.postnom || ''} ${e?.prenom || ''}`.replace(/\s+/g, ' ').trim();
const pct = (obt, max) => (max > 0 ? (obt / max) * 100 : null);

export default function Rapports() {
  const { ecole } = useEcole();
  const [mode, setMode] = useState('ecole');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // École view
  const [ecoleRows, setEcoleRows] = useState([]);
  // Classe view
  const [classeId, setClasseId] = useState('');
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [students, setStudents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [presences, setPresences] = useState([]);
  const [loadingC, setLoadingC] = useState(false);

  const classe = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId]);

  useEffect(() => {
    supabase.from('classes').select('id, nom, niveau_id, niveaux(nom)').order('nom').then(({ data }) => {
      setClasses(data || []);
      if (data && data.length) setClasseId(data[0].id);
      setLoading(false);
    });
  }, []);

  // ----- École view: average % per class -----
  useEffect(() => {
    if (mode !== 'ecole' || classes.length === 0) return;
    (async () => {
      setLoading(true);
      const allNotes = await fetchAll(() => supabase.from('notes').select('eleve_id, classe_id, points_obtenus, max_periode').order('id'));
      const perStudent = {}; // classe_id -> eleve_id -> {obt,max}
      (allNotes || []).forEach((n) => {
        if (n.points_obtenus == null) return;
        const cs = (perStudent[n.classe_id] = perStudent[n.classe_id] || {});
        const st = (cs[n.eleve_id] = cs[n.eleve_id] || { obt: 0, max: 0 });
        st.obt += Number(n.points_obtenus); st.max += Number(n.max_periode) || 0;
      });
      const rows = classes.map((c) => {
        const studs = Object.values(perStudent[c.id] || {});
        const pcts = studs.map((s) => pct(s.obt, s.max)).filter((x) => x != null);
        const moy = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
        return { id: c.id, nom: c.nom, niveau: c.niveaux?.nom || '', nb: pcts.length, moy };
      }).filter((r) => r.nb > 0).sort((a, b) => (b.moy || 0) - (a.moy || 0));
      setEcoleRows(rows);
      setLoading(false);
    })();
  }, [mode, classes]);

  const ecoleMoyenne = useMemo(() => {
    const v = ecoleRows.filter((r) => r.moy != null);
    return v.length ? v.reduce((a, b) => a + b.moy, 0) / v.length : null;
  }, [ecoleRows]);

  // ----- Classe view -----
  useEffect(() => {
    if (mode !== 'classe' || !classe) return;
    supabase.from('periodes').select('*').eq('niveau_id', classe.niveau_id).order('numero').then(({ data }) => {
      setPeriodes(data || []);
      setPeriodeId(data && data.length ? data[0].id : '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, classeId]);

  useEffect(() => {
    if (mode !== 'classe' || !classeId || !periodeId) return;
    (async () => {
      setLoadingC(true);
      const [els, nt, pr] = await Promise.all([
        supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
        fetchAll(() => supabase.from('notes').select('eleve_id, branche_id, points_obtenus, max_periode, branches(nom)').eq('classe_id', classeId).eq('periode_id', periodeId).order('id')),
        fetchAll(() => supabase.from('presences').select('eleve_id, statut').eq('classe_id', classeId).order('id')),
      ]);
      setStudents(els.data || []); setNotes(nt); setPresences(pr);
      setLoadingC(false);
    })();
  }, [mode, classeId, periodeId]);

  // Per-student aggregate (ranking) + at-risk
  const classement = useMemo(() => {
    const agg = {}; students.forEach((e) => (agg[e.id] = { e, obt: 0, max: 0, fails: 0 }));
    notes.forEach((n) => {
      if (n.points_obtenus == null || !agg[n.eleve_id]) return;
      agg[n.eleve_id].obt += Number(n.points_obtenus);
      agg[n.eleve_id].max += Number(n.max_periode) || 0;
      const p = pct(Number(n.points_obtenus), Number(n.max_periode));
      if (p != null && p < 50) agg[n.eleve_id].fails += 1;
    });
    return Object.values(agg).map((a) => ({ ...a, pct: pct(a.obt, a.max) }))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [students, notes]);

  // Failure rate per subject
  const parMatiere = useMemo(() => {
    const m = {};
    notes.forEach((n) => {
      if (n.points_obtenus == null) return;
      const key = n.branche_id;
      const g = (m[key] = m[key] || { nom: n.branches?.nom || '—', n: 0, fails: 0 });
      g.n += 1;
      const p = pct(Number(n.points_obtenus), Number(n.max_periode));
      if (p != null && p < 50) g.fails += 1;
    });
    return Object.values(m).map((g) => ({ ...g, taux: g.n ? (g.fails / g.n) * 100 : 0 })).sort((a, b) => b.taux - a.taux);
  }, [notes]);

  const presStats = useMemo(() => {
    const m = {}; students.forEach((e) => (m[e.id] = { e, absent: 0, retard: 0 }));
    presences.forEach((p) => { if (m[p.eleve_id]) { if (p.statut === 'absent') m[p.eleve_id].absent++; if (p.statut === 'retard') m[p.eleve_id].retard++; } });
    return Object.values(m);
  }, [students, presences]);

  const aRisque = classement.filter((c) => c.fails >= 2);

  function expEcole() {
    const h = 'place,classe,niveau,nb_eleves,moyenne_pourcent';
    const lines = ecoleRows.map((r, i) => `${i + 1},"${r.nom}",${r.niveau},${r.nb},${r.moy != null ? r.moy.toFixed(1) : ''}`);
    downloadCSV('rapport_ecole_classes.csv', h + '\n' + lines.join('\n') + '\n');
  }
  function expClassement() {
    const h = 'place,eleve,pourcent';
    const lines = classement.filter((c) => c.max > 0).map((c, i) => `${i + 1},"${fullName(c.e)}",${c.pct != null ? c.pct.toFixed(1) : ''}`);
    downloadCSV(`classement_${classe?.nom || ''}.csv`, h + '\n' + lines.join('\n') + '\n');
  }

  return (
    <AdminLayout title="Rapports & statistiques" subtitle="Performance de l'école et des classes, matières en difficulté, élèves à risque, présences." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <select className="input" style={{ maxWidth: 220 }} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="ecole">Vue école</option>
          <option value="classe">Vue par classe</option>
        </select>
      </div>

      {mode === 'ecole' ? (
        loading ? <div className="empty-state">Calcul…</div> : (
          <>
            <div className="stat-grid">
              <div className="stat-card"><div className="value">{ecoleMoyenne != null ? ecoleMoyenne.toFixed(1) + '%' : '—'}</div><div className="label">Moyenne de l'école</div></div>
              <div className="stat-card j"><div className="value">{ecoleRows.length}</div><div className="label">Classes avec notes</div></div>
              <div className="stat-card r"><div className="value">{ecoleRows[0]?.nom || '—'}</div><div className="label">Meilleure classe</div></div>
            </div>
            <div className="toolbar"><div className="spacer" /><button className="btn btn-secondary btn-sm" onClick={expEcole} disabled={!ecoleRows.length}>Exporter (CSV)</button></div>
            {ecoleRows.length === 0 ? <div className="empty-state">Aucune note saisie pour l'instant.</div> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th style={{ width: 60 }}>Place</th><th>Classe</th><th>Niveau</th><th>Élèves notés</th><th>Moyenne</th></tr></thead>
                  <tbody>
                    {ecoleRows.map((r, i) => (
                      <tr key={r.id}><td><strong>{i + 1}</strong></td><td>{r.nom}</td><td>{r.niveau}</td><td>{r.nb}</td>
                        <td>{r.moy != null ? <span className={'pill ' + (r.moy >= 50 ? 'pill-green' : 'pill-red')}>{r.moy.toFixed(1)}%</span> : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      ) : (
        <>
          <div className="toolbar">
            <div><label className="lbl">Classe</label>
              <select className="input" style={{ minWidth: 200 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
              </select>
            </div>
            <div><label className="lbl">Période</label>
              <select className="input" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
                {periodes.length === 0 && <option value="">Aucune</option>}
                {periodes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
          </div>

          {loadingC ? <div className="empty-state">Calcul…</div> : (
            <>
              {/* Classement */}
              <div className="panel">
                <div className="toolbar"><h3 style={{ margin: 0 }}>Classement des élèves</h3><div className="spacer" /><button className="btn btn-secondary btn-sm" onClick={expClassement} disabled={!classement.some((c) => c.max > 0)}>Exporter (CSV)</button></div>
                {classement.filter((c) => c.max > 0).length === 0 ? <div className="admin-sub" style={{ margin: 0 }}>Aucune note.</div> : (
                  <div className="table-wrap"><table className="data">
                    <thead><tr><th style={{ width: 60 }}>Place</th><th>Élève</th><th>Pourcentage</th></tr></thead>
                    <tbody>{classement.map((c, i) => c.max > 0 && (
                      <tr key={c.e.id}><td><strong>{i + 1}</strong></td><td>{fullName(c.e)}</td>
                        <td>{c.pct != null ? <span className={'pill ' + (c.pct >= 50 ? 'pill-green' : 'pill-red')}>{c.pct.toFixed(1)}%</span> : '—'}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>

              {/* Échec par matière */}
              <div className="panel">
                <h3>Taux d'échec par matière (note &lt; 50%)</h3>
                {parMatiere.length === 0 ? <div className="admin-sub" style={{ margin: 0 }}>Aucune note.</div> : (
                  <div className="table-wrap"><table className="data">
                    <thead><tr><th>Matière</th><th>Élèves notés</th><th>En échec</th><th>Taux d'échec</th></tr></thead>
                    <tbody>{parMatiere.map((g, i) => (
                      <tr key={i}><td><strong>{g.nom}</strong></td><td>{g.n}</td><td>{g.fails}</td>
                        <td><span className={'pill ' + (g.taux > 50 ? 'pill-red' : g.taux > 0 ? 'pill-gray' : 'pill-green')}>{g.taux.toFixed(0)}%</span></td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>

              {/* Élèves à risque */}
              <div className="panel">
                <h3>Élèves à risque (échec dans 2 matières ou plus)</h3>
                {aRisque.length === 0 ? <div className="admin-sub" style={{ margin: 0 }}>Aucun élève à risque.</div> : (
                  <div className="table-wrap"><table className="data">
                    <thead><tr><th>Élève</th><th>Matières en échec</th><th>Moyenne</th></tr></thead>
                    <tbody>{aRisque.map((c) => (
                      <tr key={c.e.id}><td><strong>{fullName(c.e)}</strong></td><td><span className="pill pill-red">{c.fails}</span></td>
                        <td>{c.pct != null ? c.pct.toFixed(1) + '%' : '—'}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>

              {/* Présences */}
              <div className="panel">
                <h3>Présences (année en cours)</h3>
                <div className="table-wrap"><table className="data">
                  <thead><tr><th>Élève</th><th>Absences</th><th>Retards</th></tr></thead>
                  <tbody>{presStats.map((p) => (
                    <tr key={p.e.id}><td><strong>{fullName(p.e)}</strong></td>
                      <td>{p.absent > 0 ? <span className="pill pill-red">{p.absent}</span> : 0}</td><td>{p.retard}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}
