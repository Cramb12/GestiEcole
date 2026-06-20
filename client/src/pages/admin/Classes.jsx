// Classes management — create / edit / delete, assign level + class teacher.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Classes() {
  const { ecole } = useEcole();
  const [classes, setClasses] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [counts, setCounts] = useState({}); // classe_id -> nb élèves
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [modal, setModal] = useState(null); // null | {edit?, form}
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [cl, nv, tc, el] = await Promise.all([
      supabase.from('classes').select('id, nom, annee_scolaire, niveau_id, titulaire_id, niveaux(nom), profiles(nom, postnom)').order('nom'),
      supabase.from('niveaux').select('id, nom, type').order('nom'),
      supabase.from('profiles').select('id, nom, postnom').eq('role', 'teacher').order('nom'),
      supabase.from('eleves').select('classe_id'),
    ]);
    setClasses(cl.data || []);
    setNiveaux(nv.data || []);
    setTeachers(tc.data || []);
    const c = {};
    (el.data || []).forEach((e) => {
      if (e.classe_id) c[e.classe_id] = (c[e.classe_id] || 0) + 1;
    });
    setCounts(c);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setMsg(null);
    setModal({
      edit: null,
      form: { nom: '', niveau_id: '', titulaire_id: '', annee_scolaire: ecole?.annee_scolaire || '' },
    });
  }
  function openEdit(c) {
    setMsg(null);
    setModal({
      edit: c.id,
      form: {
        nom: c.nom,
        niveau_id: c.niveau_id,
        titulaire_id: c.titulaire_id || '',
        annee_scolaire: c.annee_scolaire,
      },
    });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim() || !f.niveau_id || !f.annee_scolaire.trim()) {
      setMsg({ type: 'error', text: 'Nom, niveau et année scolaire sont obligatoires.' });
      return;
    }
    setSaving(true);
    const payload = {
      nom: f.nom.trim(),
      niveau_id: f.niveau_id,
      titulaire_id: f.titulaire_id || null,
      annee_scolaire: f.annee_scolaire.trim(),
    };
    let res;
    if (modal.edit) res = await supabase.from('classes').update(payload).eq('id', modal.edit);
    else res = await supabase.from('classes').insert(payload);
    setSaving(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
      return;
    }
    setModal(null);
    setMsg({ type: 'success', text: 'Classe enregistrée.' });
    load();
  }

  async function remove(c) {
    if ((counts[c.id] || 0) > 0) {
      setMsg({ type: 'error', text: `Impossible : ${counts[c.id]} élève(s) sont inscrits dans « ${c.nom} ».` });
      return;
    }
    if (!window.confirm(`Supprimer la classe « ${c.nom} » ?`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', c.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Classe supprimée.' });
      load();
    }
  }

  const teacherName = (t) => `${t.nom} ${t.postnom || ''}`.trim();

  return (
    <AdminLayout title="Gestion des classes" subtitle="Créez vos classes et assignez un niveau et un titulaire." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle classe</button>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{classes.length} classe(s)</span>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : classes.length === 0 ? (
        <div className="empty-state">Aucune classe. Cliquez sur « Nouvelle classe » pour commencer.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Niveau</th>
                <th>Titulaire</th>
                <th>Élèves</th>
                <th>Année</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nom}</strong></td>
                  <td><span className="pill pill-blue">{c.niveaux?.nom || '—'}</span></td>
                  <td>{c.profiles ? `${c.profiles.nom} ${c.profiles.postnom || ''}` : <span className="admin-sub" style={{ margin: 0 }}>Non assigné</span>}</td>
                  <td>{counts[c.id] || 0}</td>
                  <td>{c.annee_scolaire}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Supprimer</button>
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
          title={modal.edit ? 'Modifier la classe' : 'Nouvelle classe'}
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
              <label className="lbl">Nom de la classe <span className="req">*</span></label>
              <input className="input" placeholder="ex: 1ère A" value={modal.form.nom} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Niveau <span className="req">*</span></label>
              <select className="input" value={modal.form.niveau_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, niveau_id: e.target.value } })}>
                <option value="">— Choisir —</option>
                {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Titulaire</label>
              <select className="input" value={modal.form.titulaire_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, titulaire_id: e.target.value } })}>
                <option value="">— Aucun —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Année scolaire <span className="req">*</span></label>
              <input className="input" placeholder="2025-2026" value={modal.form.annee_scolaire} onChange={(e) => setModal({ ...modal, form: { ...modal.form, annee_scolaire: e.target.value } })} />
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
