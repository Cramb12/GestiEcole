// Staff management (non-teaching) — the director creates percepteurs and
// registrars (chargés des inscriptions). Each account is created via the
// create-teacher Edge Function (which emails the login details) and the new
// member receives a credentials email automatically.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

const ROLE_LABELS = { percepteur: 'Percepteur', inscripteur: 'Chargé des inscriptions' };

export default function Personnel() {
  const { ecole } = useEcole();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // { form, saving, error }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nom, postnom, email, role')
      .in('role', ['percepteur', 'inscripteur'])
      .order('nom');
    setStaff(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setMsg(null);
    setModal({ form: { nom: '', postnom: '', email: '', password: '', role: 'percepteur' }, saving: false, error: null });
  }

  async function create() {
    const f = modal.form;
    if (!f.nom.trim() || !f.email.trim() || !f.password) {
      setModal({ ...modal, error: 'Nom, email et mot de passe sont obligatoires.' });
      return;
    }
    if (f.password.length < 6) {
      setModal({ ...modal, error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    setModal({ ...modal, saving: true, error: null });

    const { error } = await supabase.functions.invoke('create-teacher', {
      body: {
        nom: f.nom.trim(),
        postnom: f.postnom.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.password,
        role: f.role,
      },
    });

    if (error) {
      let detail = error.message;
      try { const body = await error.context.json(); if (body?.message) detail = body.message; } catch { /* ignore */ }
      setModal({ ...modal, saving: false, error: detail });
      return;
    }

    setModal(null);
    setMsg({ type: 'success', text: `${ROLE_LABELS[f.role]} créé. Les identifiants ont été envoyés par email.` });
    load();
  }

  const set = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));
  const name = (s) => `${s.nom} ${s.postnom || ''}`.trim();

  return (
    <AdminLayout title="Personnel (perception & inscriptions)" subtitle="Créez les comptes percepteur et chargé des inscriptions. Chacun reçoit ses identifiants par email." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouveau membre</button>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{staff.length} compte(s)</span>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : staff.length === 0 ? (
        <div className="empty-state">Aucun compte. Cliquez sur « Nouveau membre ».</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Membre</th><th>Email</th><th>Fonction</th></tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><strong>{name(s)}</strong></td>
                  <td>{s.email}</td>
                  <td><span className="pill pill-green">{ROLE_LABELS[s.role] || s.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title="Nouveau membre du personnel"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={create} disabled={modal.saving}>{modal.saving ? 'Création…' : 'Créer le compte'}</button>
            </>
          }
        >
          {modal.error && <div className="alert-error">{modal.error}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Fonction <span className="req">*</span></label>
              <select className="input" value={modal.form.role} onChange={(e) => set('role', e.target.value)}>
                <option value="percepteur">Percepteur</option>
                <option value="inscripteur">Chargé des inscriptions</option>
              </select>
            </div>
            <div>
              <label className="lbl">Nom <span className="req">*</span></label>
              <input className="input" value={modal.form.nom} onChange={(e) => set('nom', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Postnom</label>
              <input className="input" value={modal.form.postnom} onChange={(e) => set('postnom', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Email <span className="req">*</span></label>
              <input className="input" type="email" value={modal.form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Mot de passe <span className="req">*</span></label>
              <input className="input" type="text" placeholder="min. 6 caractères" value={modal.form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            Le membre pourra se connecter immédiatement et recevra ses identifiants par email.
          </p>
        </Modal>
      )}
    </AdminLayout>
  );
}
