// Time-slot configuration (créneaux). Add the 7th/8th hour, afternoon
// break, edit times, etc.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Creneaux() {
  const { ecole } = useEcole();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('creneaux').select('*').order('ordre');
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setMsg(null);
    setModal({ edit: null, form: { ordre: (list.at(-1)?.ordre || 0) + 1, label: '', heure_debut: '', heure_fin: '', type: 'cours' } });
  }
  function openEdit(c) {
    setMsg(null);
    setModal({ edit: c.id, form: { ordre: c.ordre, label: c.label, heure_debut: c.heure_debut || '', heure_fin: c.heure_fin || '', type: c.type } });
  }

  async function save() {
    const f = modal.form;
    if (!f.label.trim()) { setMsg({ type: 'error', text: 'Le libellé est obligatoire.' }); return; }
    setSaving(true);
    const payload = { ordre: Number(f.ordre) || 0, label: f.label.trim(), heure_debut: f.heure_debut || null, heure_fin: f.heure_fin || null, type: f.type };
    const res = modal.edit ? await supabase.from('creneaux').update(payload).eq('id', modal.edit) : await supabase.from('creneaux').insert(payload);
    setSaving(false);
    if (res.error) { setMsg({ type: 'error', text: res.error.message }); return; }
    setModal(null); setMsg({ type: 'success', text: 'Créneau enregistré.' }); load();
  }

  async function remove(c) {
    if (!window.confirm(`Supprimer « ${c.label} » ? Les cours placés sur ce créneau seront retirés.`)) return;
    const { error } = await supabase.from('creneaux').delete().eq('id', c.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'success', text: 'Créneau supprimé.' }); load(); }
  }

  return (
    <AdminLayout title="Créneaux horaires" subtitle="Réglez les heures. Ajoutez ici la 7ème, 8ème heure et la récréation de l'après-midi quand vous voulez." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouveau créneau</button>
      </div>
      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? <div className="empty-state">Chargement…</div> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th style={{ width: 60 }}>Ordre</th><th>Libellé</th><th>Début</th><th>Fin</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.ordre}</td>
                  <td><strong>{c.label}</strong></td>
                  <td>{c.heure_debut || '—'}</td>
                  <td>{c.heure_fin || '—'}</td>
                  <td>{c.type === 'pause' ? <span className="pill" style={{ background: '#fff5d6', color: '#9a6b00' }}>Récréation</span> : <span className="pill pill-blue">Cours</span>}</td>
                  <td><div className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Modifier</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Supprimer</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title={modal.edit ? 'Modifier le créneau' : 'Nouveau créneau'}
          onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button></>}
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Libellé <span className="req">*</span></label>
              <input className="input" placeholder="ex: 7ème heure" value={modal.form.label} onChange={(e) => setModal({ ...modal, form: { ...modal.form, label: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Ordre</label>
              <input className="input" type="number" value={modal.form.ordre} onChange={(e) => setModal({ ...modal, form: { ...modal.form, ordre: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Heure de début</label>
              <input className="input" type="time" value={modal.form.heure_debut} onChange={(e) => setModal({ ...modal, form: { ...modal.form, heure_debut: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Heure de fin</label>
              <input className="input" type="time" value={modal.form.heure_fin} onChange={(e) => setModal({ ...modal, form: { ...modal.form, heure_fin: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Type</label>
              <select className="input" value={modal.form.type} onChange={(e) => setModal({ ...modal, form: { ...modal.form, type: e.target.value } })}>
                <option value="cours">Cours</option>
                <option value="pause">Récréation</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
