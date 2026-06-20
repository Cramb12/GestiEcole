// Teacher mark entry. Choose class -> subject -> period, then fill the grid.
//  - Primary titulaire: grades every subject of the class.
//  - Secondary subject teacher: grades only their assigned subject(s).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { brancheApplies } from '../../lib/notes.js';
import Layout from '../../components/Layout.jsx';
import NotesGrid from '../../components/NotesGrid.jsx';

export default function Notes() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const navigate = useNavigate();

  const [classMap, setClassMap] = useState({}); // classeId -> { classe, isPrimaryTit, assigned:[] }
  const [classeId, setClasseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [brancheId, setBrancheId] = useState('');
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [loadingCtx, setLoadingCtx] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [tit, aff] = await Promise.all([
        supabase.from('classes').select('id, nom, annee, niveau_id, section_id, niveaux(type, systeme_periodes)').eq('titulaire_id', user.id),
        supabase
          .from('enseignant_branches')
          .select('classe_id, classes(id, nom, annee, niveau_id, section_id, niveaux(type, systeme_periodes)), branches(id, nom, max_points)')
          .eq('teacher_id', user.id),
      ]);
      const map = {};
      (tit.data || []).forEach((c) => {
        map[c.id] = map[c.id] || { classe: c, isPrimaryTit: c.niveaux?.type === 'primaire', assigned: [] };
      });
      (aff.data || []).forEach((a) => {
        const c = a.classes;
        if (!c) return;
        map[c.id] = map[c.id] || { classe: c, isPrimaryTit: false, assigned: [] };
        if (a.branches) map[c.id].assigned.push(a.branches);
      });
      setClassMap(map);
      const ids = Object.keys(map);
      if (ids.length) setClasseId(ids[0]);
      setLoadingCtx(false);
    }
    load();
  }, [user]);

  const entry = classMap[classeId];

  // Load applicable courses + periods when the class changes.
  useEffect(() => {
    if (!entry) { setCourses([]); setPeriodes([]); return; }
    async function load() {
      const c = entry.classe;
      // Periods for this level.
      const { data: per } = await supabase.from('periodes').select('*').eq('niveau_id', c.niveau_id).order('numero');
      setPeriodes(per || []);
      setPeriodeId(per && per.length ? per[0].id : '');

      // Courses.
      if (entry.isPrimaryTit) {
        const { data: br } = await supabase
          .from('branches')
          .select('id, nom, max_points, annee, section_id')
          .eq('niveau_id', c.niveau_id)
          .is('section_id', null)
          .order('ordre').order('nom');
        const list = (br || []).filter((b) => brancheApplies(b.annee, c.annee));
        setCourses(list);
        setBrancheId(list.length ? list[0].id : '');
      } else {
        const list = entry.assigned;
        setCourses(list);
        setBrancheId(list.length ? list[0].id : '');
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  const branche = useMemo(() => courses.find((b) => b.id === brancheId), [courses, brancheId]);
  const periode = useMemo(() => periodes.find((p) => p.id === periodeId), [periodes, periodeId]);
  const classes = Object.values(classMap);

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/enseignant')} style={{ marginBottom: 16 }}>
        ← Retour
      </button>
      <h1 className="admin-h1">Saisie des notes</h1>
      <p className="admin-sub">Choisissez la classe, le cours et la période, puis saisissez les notes (Travaux Journaliers + Examen).</p>

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

          {!branche || !periode ? (
            <div className="empty-state">
              {courses.length === 0 ? 'Aucun cours disponible pour cette classe.' : periodes.length === 0 ? "Aucune période définie (l'administrateur doit les créer)." : 'Sélectionnez un cours et une période.'}
            </div>
          ) : (
            <NotesGrid
              key={`${classeId}-${brancheId}-${periodeId}`}
              classeId={classeId}
              branche={branche}
              periode={periode}
              anneeScolaire={ecole?.annee_scolaire || ''}
              canEdit
            />
          )}
        </>
      )}
    </Layout>
  );
}
