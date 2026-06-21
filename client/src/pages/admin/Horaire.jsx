// Class timetable. The schedule is built FROM existing assignments:
// only subjects already assigned to a teacher for this class can be placed.
// (Step 1: assign teachers in "Enseignants". Step 2: build the timetable.)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { downloadCSV } from '../../lib/csv.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';
import CsvImportModal from '../../components/CsvImportModal.jsx';

const JOURMAP = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function Horaire() {
  const { ecole } = useEcole();
  const annee = ecole?.annee_scolaire || '';
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [creneaux, setCreneaux] = useState([]);
  const [affectations, setAffectations] = useState([]); // class's assignments
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [cell, setCell] = useState(null); // { creneau, jour, form, existingId }
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const classe = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId]);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, nom, niveau_id, niveaux(nom)').order('nom'),
      supabase.from('creneaux').select('*').order('ordre'),
    ]).then(([cl, cr]) => {
      setClasses(cl.data || []);
      setCreneaux(cr.data || []);
      if (cl.data && cl.data.length) setClasseId(cl.data[0].id);
      setLoading(false);
    });
  }, []);

  async function loadClasse() {
    if (!classeId) return;
    const [af, ho] = await Promise.all([
      supabase.from('enseignant_branches')
        .select('id, branche_id, teacher_id, branches(nom), profiles(nom, postnom)')
        .eq('classe_id', classeId).eq('annee_scolaire', annee),
      supabase.from('horaires')
        .select('id, creneau_id, jour, salle, branche_id, enseignant_id, branches(nom), profiles(nom, postnom)')
        .eq('classe_id', classeId).eq('annee_scolaire', annee),
    ]);
    setAffectations(af.data || []);
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
    // Find which assignment matches an existing slot.
    const aff = h ? affectations.find((a) => a.branche_id === h.branche_id && a.teacher_id === h.enseignant_id) : null;
    setCell({ creneau, jour, existingId: h?.id || null, form: { affectation_id: aff?.id || '', salle: h?.salle || '' } });
  }

  async function save() {
    const aff = affectations.find((a) => a.id === cell.form.affectation_id);
    if (!aff) { setMsg({ type: 'error', text: 'Choisissez un cours affecté.' }); return; }
    setSaving(true);

    // Conflict: teacher already busy elsewhere at this day+slot.
    const { data: conf } = await supabase
      .from('horaires').select('classes(nom)')
      .eq('enseignant_id', aff.teacher_id).eq('jour', cell.jour).eq('creneau_id', cell.creneau.id)
      .eq('annee_scolaire', annee).neq('classe_id', classeId);
    if (conf && conf.length) {
      setSaving(false);
      setMsg({ type: 'error', text: `Conflit : cet enseignant est déjà en « ${conf[0].classes?.nom} » à ce créneau.` });
      return;
    }

    const row = { classe_id: classeId, creneau_id: cell.creneau.id, jour: cell.jour, branche_id: aff.branche_id, enseignant_id: aff.teacher_id, salle: cell.form.salle.trim() || null, annee_scolaire: annee };
    const up = await supabase.from('horaires').upsert(row, { onConflict: 'classe_id,creneau_id,jour,annee_scolaire' });
    setSaving(false);
    if (up.error) { setMsg({ type: 'error', text: up.error.message }); return; }
    setCell(null); setMsg({ type: 'success', text: 'Créneau enregistré.' }); loadClasse();
  }

  async function clearCell() {
    if (!cell.existingId) { setCell(null); return; }
    const { error } = await supabase.from('horaires').delete().eq('id', cell.existingId);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setCell(null); setMsg({ type: 'success', text: 'Créneau vidé.' }); loadClasse(); }
  }

  const affLabel = (a) => `${a.branches?.nom || '—'} — ${a.profiles ? `${a.profiles.nom} ${a.profiles.postnom || ''}`.trim() : ''}`;

  function dlTemplate() {
    downloadCSV('modele_horaire.csv', 'classe,jour,creneau,matiere,enseignant_email,salle\n1ère Hum. Scientifique,Lundi,1ère heure,Mathématiques,j.kalala@ecole.cd,A1\n');
  }

  // Bulk timetable import. Each row must reference a subject already assigned
  // to a teacher for that class (assignment-first rule kept).
  async function importHoraires(rows) {
    let ok = 0; const errors = [];
    const { data: allCl } = await supabase.from('classes').select('id, nom');
    const clByName = {}; (allCl || []).forEach((c) => (clByName[c.nom.toLowerCase().trim()] = c.id));
    const crByLabel = {}; creneaux.forEach((c) => (crByLabel[c.label.toLowerCase().trim()] = c));
    const { data: allAff } = await supabase.from('enseignant_branches')
      .select('classe_id, branche_id, teacher_id, branches(nom), profiles(email)').eq('annee_scolaire', annee);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const ligne = i + 2;
      const cid = clByName[String(r.classe || '').toLowerCase().trim()];
      if (!cid) { errors.push(`Ligne ${ligne}: classe « ${r.classe} » introuvable.`); continue; }
      const jour = JOURMAP[String(r.jour || '').toLowerCase().trim()];
      if (!jour) { errors.push(`Ligne ${ligne}: jour « ${r.jour} » invalide (Lundi…Samedi).`); continue; }
      const cr = crByLabel[String(r.creneau || '').toLowerCase().trim()];
      if (!cr) { errors.push(`Ligne ${ligne}: créneau « ${r.creneau} » introuvable.`); continue; }
      if (cr.type === 'pause') { errors.push(`Ligne ${ligne}: « ${r.creneau} » est une récréation.`); continue; }
      let cands = (allAff || []).filter((a) => a.classe_id === cid && (a.branches?.nom || '').toLowerCase().trim() === String(r.matiere || '').toLowerCase().trim());
      if (r.enseignant_email) cands = cands.filter((a) => (a.profiles?.email || '').toLowerCase().trim() === String(r.enseignant_email).toLowerCase().trim());
      if (cands.length === 0) { errors.push(`Ligne ${ligne}: « ${r.matiere} » non affecté à cette classe (affectez-le d'abord).`); continue; }
      const aff = cands[0];
      const { error } = await supabase.from('horaires').upsert(
        { classe_id: cid, creneau_id: cr.id, jour, branche_id: aff.branche_id, enseignant_id: aff.teacher_id, salle: r.salle || null, annee_scolaire: annee },
        { onConflict: 'classe_id,creneau_id,jour,annee_scolaire' });
      if (error) errors.push(`Ligne ${ligne}: ${error.message}`); else ok++;
    }
    return { ok, errors };
  }

  return (
    <AdminLayout title="Emploi du temps" subtitle="Construisez l'horaire à partir des cours déjà affectés. Étape 1 : affecter les enseignants. Étape 2 : placer les cours dans la grille." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" style={{ minWidth: 220 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{affectations.length} cours affecté(s)</span>
        <button className="btn btn-outline btn-sm" onClick={() => { setMsg(null); setImportOpen(true); }}>Importer (CSV)</button>
        <button className="btn btn-secondary btn-sm" onClick={dlTemplate}>Modèle</button>
        <Link className="btn btn-secondary btn-sm" to="/admin/creneaux" style={{ textDecoration: 'none' }}>Régler les créneaux</Link>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : creneaux.length === 0 ? (
        <div className="empty-state">Aucun créneau. Configurez-les dans « Régler les créneaux ».</div>
      ) : affectations.length === 0 ? (
        <div className="empty-state">
          Aucun cours n'est affecté à cette classe.<br />
          Affectez d'abord des enseignants dans <Link to="/admin/enseignants">Enseignants → Gérer les affectations</Link>, puis revenez ici.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="ht-table">
            <thead>
              <tr><th className="ht-time">Heure</th>{JOURS.map((j) => <th key={j}>{j}</th>)}</tr>
            </thead>
            <tbody>
              {creneaux.map((cr) => cr.type === 'pause' ? (
                <tr className="ht-pause" key={cr.id}><td colSpan={JOURS.length + 1}>{cr.label} ({cr.heure_debut} – {cr.heure_fin})</td></tr>
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
              <label className="lbl">Cours affecté <span className="req">*</span></label>
              <select className="input" value={cell.form.affectation_id} onChange={(e) => setCell({ ...cell, form: { ...cell.form, affectation_id: e.target.value } })}>
                <option value="">— Choisir —</option>
                {affectations.map((a) => <option key={a.id} value={a.id}>{affLabel(a)}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Salle</label>
              <input className="input" value={cell.form.salle} onChange={(e) => setCell({ ...cell, form: { ...cell.form, salle: e.target.value } })} />
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            Seuls les cours déjà affectés à cette classe apparaissent. Pour en ajouter, passez par « Enseignants → Gérer les affectations ».
          </p>
        </Modal>
      )}

      {importOpen && (
        <CsvImportModal
          title="Importer l'horaire (CSV)"
          expected="classe, jour, creneau, matiere, enseignant_email, salle"
          note="Le cours doit déjà être affecté à la classe. jour = Lundi…Samedi ; creneau = libellé exact (ex. « 1ère heure »)."
          onImport={importHoraires}
          onClose={() => setImportOpen(false)}
          onDone={loadClasse}
        />
      )}
    </AdminLayout>
  );
}
