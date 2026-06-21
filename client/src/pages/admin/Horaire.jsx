// Class timetable. You build the schedule; the teacher↔subject↔class
// assignment (enseignant_branches) is created automatically from it.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { brancheApplies } from '../../lib/notes.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function Horaire() {
  const { ecole } = useEcole();
  const annee = ecole?.annee_scolaire || '';
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [creneaux, setCreneaux] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [cell, setCell] = useState(null); // { creneau, jour, form, existingId }
  const [saving, setSaving] = useState(false);

  const classe = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId]);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, nom, niveau_id, section_id, annee, niveaux(nom)').order('nom'),
      supabase.from('creneaux').select('*').order('ordre'),
      supabase.from('profiles').select('id, nom, postnom').eq('role', 'teacher').order('nom'),
    ]).then(([cl, cr, tc]) => {
      setClasses(cl.data || []);
      setCreneaux(cr.data || []);
      setTeachers(tc.data || []);
      if (cl.data && cl.data.length) setClasseId(cl.data[0].id);
      setLoading(false);
    });
  }, []);

  async function loadClasse() {
    if (!classe) return;
    const [br, ho] = await Promise.all([
      supabase.from('branches').select('id, nom, section_id, annee').eq('niveau_id', classe.niveau_id).order('ordre').order('nom'),
      supabase.from('horaires').select('id, creneau_id, jour, salle, branche_id, enseignant_id, branches(nom), profiles(nom, postnom)').eq('classe_id', classeId).eq('annee_scolaire', annee),
    ]);
    setBranches((br.data || []).filter((b) => (!b.section_id || b.section_id === classe.section_id) && brancheApplies(b.annee, classe.annee)));
    setHoraires(ho.data || []);
  }

  useEffect(() => {
    loadClasse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  const horaireMap = useMemo(() => {
    const m = {};
    horaires.forEach((h) => (m[`${h.creneau_id}-${h.jour}`] = h));
    return m;
  }, [horaires]);

  function openCell(creneau, jour) {
    setMsg(null);
    const h = horaireMap[`${creneau.id}-${jour}`];
    setCell({
      creneau, jour,
      existingId: h?.id || null,
      form: { branche_id: h?.branche_id || '', enseignant_id: h?.enseignant_id || '', salle: h?.salle || '' },
    });
  }

  async function save() {
    const f = cell.form;
    if (!f.branche_id || !f.enseignant_id) {
      setMsg({ type: 'error', text: 'Choisissez la matière et l\'enseignant.' });
      return;
    }
    setSaving(true);

    // Conflict: teacher already busy elsewhere at this day+slot.
    const { data: conf } = await supabase
      .from('horaires')
      .select('classes(nom)')
      .eq('enseignant_id', f.enseignant_id)
      .eq('jour', cell.jour)
      .eq('creneau_id', cell.creneau.id)
      .eq('annee_scolaire', annee)
      .neq('classe_id', classeId);
    if (conf && conf.length) {
      setSaving(false);
      setMsg({ type: 'error', text: `Conflit : cet enseignant est déjà en « ${conf[0].classes?.nom} » à ce créneau.` });
      return;
    }

    // Upsert the timetable slot.
    const row = { classe_id: classeId, creneau_id: cell.creneau.id, jour: cell.jour, branche_id: f.branche_id, enseignant_id: f.enseignant_id, salle: f.salle.trim() || null, annee_scolaire: annee };
    const up = await supabase.from('horaires').upsert(row, { onConflict: 'classe_id,creneau_id,jour,annee_scolaire' });
    if (up.error) { setSaving(false); setMsg({ type: 'error', text: up.error.message }); return; }

    // Auto-create the assignment (enseignant_branches) if missing.
    await supabase.from('enseignant_branches').upsert(
      { teacher_id: f.enseignant_id, branche_id: f.branche_id, classe_id: classeId, annee_scolaire: annee },
      { onConflict: 'teacher_id,branche_id,classe_id,annee_scolaire' }
    );

    setSaving(false);
    setCell(null);
    setMsg({ type: 'success', text: 'Créneau enregistré (affectation créée si besoin).' });
    loadClasse();
  }

  async function clearCell() {
    if (!cell.existingId) { setCell(null); return; }
    const { error } = await supabase.from('horaires').delete().eq('id', cell.existingId);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setCell(null); setMsg({ type: 'success', text: 'Créneau vidé.' }); loadClasse(); }
  }

  const tName = (t) => `${t.nom} ${t.postnom || ''}`.trim();
  const brName = (id) => branches.find((b) => b.id === id)?.nom || '';

  return (
    <AdminLayout title="Emploi du temps" subtitle="Construisez l'horaire par classe. L'affectation matière↔enseignant est créée automatiquement." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" style={{ minWidth: 220 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div className="spacer" />
        <Link className="btn btn-secondary btn-sm" to="/admin/creneaux" style={{ textDecoration: 'none' }}>Régler les créneaux</Link>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : creneaux.length === 0 ? (
        <div className="empty-state">Aucun créneau. Configurez-les dans « Régler les créneaux ».</div>
      ) : (
        <div className="table-wrap">
          <table className="ht-table">
            <thead>
              <tr>
                <th className="ht-time">Heure</th>
                {JOURS.map((j) => <th key={j}>{j}</th>)}
              </tr>
            </thead>
            <tbody>
              {creneaux.map((cr) => cr.type === 'pause' ? (
                <tr className="ht-pause" key={cr.id}>
                  <td colSpan={JOURS.length + 1}>{cr.label} ({cr.heure_debut} – {cr.heure_fin})</td>
                </tr>
              ) : (
                <tr key={cr.id}>
                  <td className="ht-time"><span className="lab">{cr.label}</span>{cr.heure_debut}–{cr.heure_fin}</td>
                  {JOURS.map((_, ji) => {
                    const jour = ji + 1;
                    const h = horaireMap[`${cr.id}-${jour}`];
                    return (
                      <td key={jour} className={'ht-cell' + (h ? ' filled' : '')} onClick={() => openCell(cr, jour)}>
                        {h ? (
                          <>
                            <span className="m">{h.branches?.nom || '—'}</span>
                            <span className="p">{h.profiles ? `${h.profiles.nom} ${h.profiles.postnom || ''}`.trim() : ''}</span>
                            {h.salle && <div className="s">Salle {h.salle}</div>}
                          </>
                        ) : <div className="ht-empty">+</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cell && (
        <Modal
          title={`${cell.creneau.label} — ${JOURS[cell.jour - 1]}`}
          onClose={() => setCell(null)}
          footer={
            <>
              {cell.existingId && <button className="btn btn-danger" onClick={clearCell} style={{ marginRight: 'auto' }}>Vider</button>}
              <button className="btn btn-secondary" onClick={() => setCell(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
            </>
          }
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Matière <span className="req">*</span></label>
              <select className="input" value={cell.form.branche_id} onChange={(e) => setCell({ ...cell, form: { ...cell.form, branche_id: e.target.value } })}>
                <option value="">— Choisir —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Enseignant <span className="req">*</span></label>
              <select className="input" value={cell.form.enseignant_id} onChange={(e) => setCell({ ...cell, form: { ...cell.form, enseignant_id: e.target.value } })}>
                <option value="">— Choisir —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{tName(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Salle</label>
              <input className="input" value={cell.form.salle} onChange={(e) => setCell({ ...cell, form: { ...cell.form, salle: e.target.value } })} />
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            En enregistrant, l'affectation « {brName(cell.form.branche_id)} » → cet enseignant pour cette classe est créée automatiquement.
          </p>
        </Modal>
      )}
    </AdminLayout>
  );
}
