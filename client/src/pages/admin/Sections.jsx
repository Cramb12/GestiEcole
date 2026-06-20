// Sections management (for Humanités) — create / edit / delete + defaults.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { DEFAULT_SECTIONS } from '../../data/defaults.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Sections() {
  const { ecole } = useEcole();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('sections').select('*').order('nom');
    setSections(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function preload() {
    if (!window.confirm('Pré-charger les sections standard ? Vous pourrez les modifier ensuite.')) return;
    const { error } = await supabase.from('sections').insert(DEFAULT_SECTIONS);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: `${DEFAULT_SECTIONS.length} sections ajoutées.` });
      load();
    }
  }

  function openCreate() {
    setMsg(null);
    setModal({ edit: null, form: { nom: '', code: '' } });
  }
  function openEdit(s) {
    setMsg(null);
    setModal({ edit: s.id, form: { nom: s.nom, code: s.code || '' } });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim()) {
      setMsg({ type: 'error', text: 'Le nom de la section est obligatoire.' });
      return;
    }
    setSaving(true);
    const payload = { nom: f.nom.trim(), code: f.code.trim() || null };
    let res;
    if (modal.edit) res = await supabase.from('sections').update(payload).eq('id', modal.edit);
    else res = await supabase.from('sections').insert(payload);
    setSaving(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
      return;
    }
    setModal(null);
    setMsg({ type: 'success', text: 'Section enregistrée.' });
    load();
  }

  async function remove(s) {
    if (!window.confirm(`Supprimer la section « ${s.nom} » ?`)) return;
    const { error } = await supabase.from('sections').delete().eq('id', s.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Section supprimée.' });
      load();
    }
  }

  return (
    <AdminLayout title="Sections (Humanités)" subtitle="Les sections sont assignées aux classes d'humanités. Liste à ajuster selon votre document officiel." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle section</button>
        <button className="btn btn-outline btn-sm" onClick={preload}>Pré-charger les sections standard</button>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{sections.length} section(s)</span>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : sections.length === 0 ? (
        <div className="empty-state">Aucune section. Utilisez « Pré-charger les sections standard » pour démarrer.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Section</th><th>Code</th><th></th></tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.nom}</strong></td>
                  <td>{s.code || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>Supprimer</button>
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
          title={modal.edit ? 'Modifier la section' : 'Nouvelle section'}
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
              <input className="input" placeholder="ex: Scientifique" value={modal.form.nom} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Code</label>
              <input className="input" placeholder="ex: SCI" value={modal.form.code} onChange={(e) => setModal({ ...modal, form: { ...modal.form, code: e.target.value } })} />
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
