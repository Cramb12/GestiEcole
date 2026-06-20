// Subjects (branches) management — per level, with DRC default pre-loading.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { defaultBranches } from '../../data/defaults.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Branches() {
  const { ecole } = useEcole();
  const [niveaux, setNiveaux] = useState([]);
  const [niveauId, setNiveauId] = useState('');
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const niveau = niveaux.find((n) => n.id === niveauId);

  useEffect(() => {
    supabase
      .from('niveaux')
      .select('id, nom, type')
      .order('nom')
      .then(({ data }) => {
        setNiveaux(data || []);
        if (data && data.length) setNiveauId(data[0].id);
      });
  }, []);

  async function loadBranches(id) {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('niveau_id', id)
      .order('ordre')
      .order('nom');
    setBranches(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadBranches(niveauId);
  }, [niveauId]);

  async function preload() {
    if (!niveau) return;
    if (!window.confirm(`Pré-charger les matières DRC par défaut pour « ${niveau.nom} » ?`)) return;
    const defs = defaultBranches(niveau.type);
    const rows = defs.map((d, i) => ({ ...d, niveau_id: niveau.id, ordre: i + 1 }));
    const { error } = await supabase.from('branches').insert(rows);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: `${rows.length} matières ajoutées.` });
      loadBranches(niveauId);
    }
  }

  function openCreate() {
    setMsg(null);
    setModal({ edit: null, form: { nom: '', domaine: '', max_points: 20, ordre: branches.length + 1 } });
  }
  function openEdit(b) {
    setMsg(null);
    setModal({ edit: b.id, form: { nom: b.nom, domaine: b.domaine || '', max_points: b.max_points, ordre: b.ordre } });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim()) {
      setMsg({ type: 'error', text: 'Le nom de la matière est obligatoire.' });
      return;
    }
    if (f.max_points === '' || Number(f.max_points) < 0) {
      setMsg({ type: 'error', text: 'Le maximum de points doit être un nombre positif.' });
      return;
    }
    setSaving(true);
    const payload = {
      nom: f.nom.trim(),
      domaine: f.domaine.trim() || null,
      max_points: Number(f.max_points),
      ordre: Number(f.ordre) || 0,
      niveau_id: niveauId,
    };
    let res;
    if (modal.edit) res = await supabase.from('branches').update(payload).eq('id', modal.edit);
    else res = await supabase.from('branches').insert(payload);
    setSaving(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
      return;
    }
    setModal(null);
    setMsg({ type: 'success', text: 'Matière enregistrée.' });
    loadBranches(niveauId);
  }

  async function remove(b) {
    if (!window.confirm(`Supprimer la matière « ${b.nom} » ?`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', b.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Matière supprimée.' });
      loadBranches(niveauId);
    }
  }

  return (
    <AdminLayout title="Gestion des matières" subtitle="Définissez les branches par niveau, leur domaine, leur maximum de points et leur ordre d'affichage." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Niveau</label>
          <select className="input" style={{ minWidth: 200 }} value={niveauId} onChange={(e) => setNiveauId(e.target.value)}>
            {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline btn-sm" onClick={preload}>⬇ Pré-charger les matières DRC</button>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Nouvelle matière</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : branches.length === 0 ? (
        <div className="empty-state">
          Aucune matière pour ce niveau.<br />
          Utilisez « Pré-charger les matières DRC » pour démarrer rapidement.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Ordre</th>
                <th>Matière</th>
                <th>Domaine</th>
                <th style={{ width: 90 }}>Max</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td>{b.ordre}</td>
                  <td><strong>{b.nom}</strong></td>
                  <td><span className="admin-sub" style={{ margin: 0 }}>{b.domaine || '—'}</span></td>
                  <td>{b.max_points}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title={modal.edit ? 'Modifier la matière' : 'Nouvelle matière'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </>
          }
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Nom <span className="req">*</span></label>
              <input className="input" value={modal.form.nom} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Domaine</label>
              <input className="input" placeholder="ex: Domaine des Langues" value={modal.form.domaine} onChange={(e) => setModal({ ...modal, form: { ...modal.form, domaine: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Maximum de points <span className="req">*</span></label>
              <input className="input" type="number" min="0" value={modal.form.max_points} onChange={(e) => setModal({ ...modal, form: { ...modal.form, max_points: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Ordre d'affichage</label>
              <input className="input" type="number" min="0" value={modal.form.ordre} onChange={(e) => setModal({ ...modal, form: { ...modal.form, ordre: e.target.value } })} />
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
