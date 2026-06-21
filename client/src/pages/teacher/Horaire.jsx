// Teacher's weekly timetable (read-only).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Layout from '../../components/Layout.jsx';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function HoraireTeacher() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const navigate = useNavigate();
  const [creneaux, setCreneaux] = useState([]);
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('creneaux').select('*').order('ordre'),
      supabase.from('horaires').select('creneau_id, jour, salle, branches(nom), classes(nom)').eq('enseignant_id', user.id),
    ]).then(([cr, ho]) => {
      setCreneaux(cr.data || []);
      setHoraires(ho.data || []);
      setLoading(false);
    });
  }, [user]);

  const map = useMemo(() => {
    const m = {};
    horaires.forEach((h) => (m[`${h.creneau_id}-${h.jour}`] = h));
    return m;
  }, [horaires]);

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/enseignant')} style={{ marginBottom: 16 }}>← Retour</button>
      <h1 className="admin-h1">Mon emploi du temps</h1>
      <p className="admin-sub">Vos cours de la semaine (établi par l'administration).</p>

      {loading ? <div className="empty-state">Chargement…</div> : horaires.length === 0 ? (
        <div className="empty-state">Aucun cours à votre horaire pour le moment.</div>
      ) : (
        <div className="table-wrap">
          <table className="ht-table">
            <thead><tr><th className="ht-time">Heure</th>{JOURS.map((j) => <th key={j}>{j}</th>)}</tr></thead>
            <tbody>
              {creneaux.map((cr) => cr.type === 'pause' ? (
                <tr className="ht-pause" key={cr.id}><td colSpan={JOURS.length + 1}>{cr.label} ({cr.heure_debut} – {cr.heure_fin})</td></tr>
              ) : (
                <tr key={cr.id}>
                  <td className="ht-time"><span className="lab">{cr.label}</span>{cr.heure_debut}–{cr.heure_fin}</td>
                  {JOURS.map((_, ji) => {
                    const h = map[`${cr.id}-${ji + 1}`];
                    return (
                      <td key={ji} className={'ht-cell' + (h ? ' filled' : '')}>
                        {h ? (<><span className="m">{h.branches?.nom || ''}</span><span className="p">{h.classes?.nom || ''}</span>{h.salle && <div className="s">Salle {h.salle}</div>}</>) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
