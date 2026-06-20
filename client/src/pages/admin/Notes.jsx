// Admin marks overview for a class + period:
//  - entry status per subject (how many students graded)
//  - automatic ranking (classement) by percentage
//  - open any subject's grid to view/override
//  - CSV export of the ranking
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { brancheApplies, ranking } from '../../lib/notes.js';
import { downloadCSV } from '../../lib/csv.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import NotesGrid from '../../components/NotesGrid.jsx';

export default function Notes() {
  const { ecole } = useEcole();
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [editBranche, setEditBranche] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('classes').select('id, nom, annee, niveau_id, section_id, niveaux(nom)').order('nom').then(({ data }) => {
      setClasses(data || []);
      if (data && data.length) setClasseId(data[0].id);
    });
  }, []);

  const classe = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId]);

  // Periods + applicable courses when class changes.
  useEffect(() => {
    if (!classe) return;
    async function load() {
      const [per, br] = await Promise.all([
        supabase.from('periodes').select('*').eq('niveau_id', classe.niveau_id).order('numero'),
        supabase.from('branches').select('id, nom, max_points, annee, section_id').eq('niveau_id', classe.niveau_id).order('ordre').order('nom'),
      ]);
      setPeriodes(per.data || []);
      setPeriodeId(per.data && per.data.length ? per.data[0].id : '');
      const list = (br.data || []).filter(
        (b) => (b.section_id || null) === (classe.section_id || null) && brancheApplies(b.annee, classe.annee)
      );
      setCourses(list);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  async function loadData() {
    if (!classe || !periodeId) return;
    setLoading(true);
    const [els, nt] = await Promise.all([
      supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
      supabase.from('notes').select('eleve_id, branche_id, points_obtenus, max_periode').eq('classe_id', classeId).eq('periode_id', periodeId),
    ]);
    setStudents(els.data || []);
    setNotes(nt.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, periodeId]);

  // Graded count per subject.
  const statusByBranche = useMemo(() => {
    const m = {};
    notes.forEach((n) => {
      if (n.points_obtenus != null) m[n.branche_id] = (m[n.branche_id] || 0) + 1;
    });
    return m;
  }, [notes]);

  // Ranking: per student sum(obtenus)/sum(max) over all graded subjects.
  const classement = useMemo(() => {
    const agg = {};
    students.forEach((e) => (agg[e.id] = { obt: 0, max: 0 }));
    notes.forEach((n) => {
      if (n.points_obtenus != null && agg[n.eleve_id]) {
        agg[n.eleve_id].obt += Number(n.points_obtenus);
        agg[n.eleve_id].max += Number(n.max_periode) || 0;
      }
    });
    const items = students.map((e) => {
      const a = agg[e.id];
      const pct = a.max > 0 ? (a.obt / a.max) * 100 : 0;
      return { key: e.id, eleve: e, obt: a.obt, max: a.max, pct };
    });
    const place = ranking(items.filter((i) => i.max > 0).map((i) => ({ key: i.key, pct: i.pct })));
    return items.map((i) => ({ ...i, place: i.max > 0 ? place[i.key] : null })).sort((a, b) => b.pct - a.pct);
  }, [students, notes]);

  const fullName = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

  function exportCSV() {
    const header = 'place,nom,points_obtenus,maxima,pourcentage';
    const lines = classement.map((c) =>
      `${c.place ?? ''},"${fullName(c.eleve)}",${c.obt},${c.max},${c.max > 0 ? c.pct.toFixed(1) : ''}`
    );
    downloadCSV(`classement_${classe?.nom || 'classe'}.csv`, header + '\n' + lines.join('\n') + '\n');
  }

  return (
    <AdminLayout title="Notes — Suivi & classement" subtitle="État de la saisie par cours, classement automatique, et correction éventuelle." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" style={{ minWidth: 200 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div>
          <label className="lbl">Période</label>
          <select className="input" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
            {periodes.length === 0 && <option value="">Aucune période</option>}
            {periodes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!classement.length}>Exporter le classement (CSV)</button>
      </div>

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : (
        <>
          {/* Entry status per subject */}
          <div className="panel">
            <h3>État de la saisie ({courses.length} cours)</h3>
            {courses.length === 0 ? (
              <div className="admin-sub" style={{ margin: 0 }}>Aucun cours pour cette classe. Configurez les matières.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Cours</th><th>Saisis</th><th>État</th><th></th></tr></thead>
                  <tbody>
                    {courses.map((b) => {
                      const done = statusByBranche[b.id] || 0;
                      const full = students.length > 0 && done >= students.length;
                      return (
                        <tr key={b.id}>
                          <td><strong>{b.nom}</strong></td>
                          <td>{done}/{students.length}</td>
                          <td>{done === 0 ? <span className="pill pill-gray">À saisir</span> : full ? <span className="pill pill-green">Complet</span> : <span className="pill" style={{ background: '#fff5d6', color: '#9a6b00' }}>Partiel</span>}</td>
                          <td><button className="btn btn-outline btn-sm" onClick={() => setEditBranche(b)}>Voir / corriger</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ranking */}
          <div className="panel">
            <h3>Classement de la période</h3>
            {classement.filter((c) => c.max > 0).length === 0 ? (
              <div className="admin-sub" style={{ margin: 0 }}>Aucune note saisie pour cette période.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th style={{ width: 60 }}>Place</th><th>Élève</th><th>Total</th><th>Maxima</th><th>%</th></tr></thead>
                  <tbody>
                    {classement.map((c) => (
                      <tr key={c.key}>
                        <td>{c.place ? <strong>{c.place}</strong> : '—'}</td>
                        <td>{fullName(c.eleve)}</td>
                        <td>{c.max > 0 ? c.obt : '—'}</td>
                        <td>{c.max > 0 ? c.max : '—'}</td>
                        <td>{c.max > 0 ? c.pct.toFixed(1) + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editBranche && periodeId && (
        <div className="panel">
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>Correction — {editBranche.nom}</h3>
            <div className="spacer" />
            <button className="btn btn-secondary btn-sm" onClick={() => setEditBranche(null)}>Fermer</button>
          </div>
          <NotesGrid
            key={`${classeId}-${editBranche.id}-${periodeId}`}
            classeId={classeId}
            branche={editBranche}
            periode={periodes.find((p) => p.id === periodeId)}
            anneeScolaire={ecole?.annee_scolaire || ''}
            canEdit
            onSaved={loadData}
          />
        </div>
      )}
    </AdminLayout>
  );
}
