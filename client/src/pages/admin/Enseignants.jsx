// Teachers management — create accounts (via Edge Function) + assignments.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Enseignants() {
  const { ecole } = useEcole();
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [affectations, setAffectations] = useState([]); // raw rows with joins
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [createModal, setCreateModal] = useState(null); // { form, saving, error }
  const [assignFor, setAssignFor] = useState(null); // teacher object

  async function load() {
    setLoading(true);
    const [tc, cl, br, af] = await Promise.all([
      supabase.from('profiles').select('id, nom, postnom, email').eq('role', 'teacher').order('nom'),
      supabase.from('classes').select('id, nom, niveau_id, niveaux(nom)').order('nom'),
      supabase.from('branches').select('id, nom, niveau_id').order('ordre').order('nom'),
      supabase.from('enseignant_branches').select('id, teacher_id, annee_scolaire, branches(nom), classes(nom)'),
    ]);
    setTeachers(tc.data || []);
    setClasses(cl.data || []);
    setBranches(br.data || []);
    setAffectations(af.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const affByTeacher = useMemo(() => {
    const m = {};
    affectations.forEach((a) => {
      (m[a.teacher_id] = m[a.teacher_id] || []).push(a);
    });
    return m;
  }, [affectations]);

  // ---- Create teacher (calls the create-teacher Edge Function) --------
  function openCreate() {
    setMsg(null);
    setCreateModal({ form: { nom: '', postnom: '', email: '', password: '' }, saving: false, error: null });
  }

  async function createTeacher() {
    const f = createModal.form;
    if (!f.nom.trim() || !f.email.trim() || !f.password) {
      setCreateModal({ ...createModal, error: 'Nom, email et mot de passe sont obligatoires.' });
      return;
    }
    if (f.password.length < 6) {
      setCreateModal({ ...createModal, error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    setCreateModal({ ...createModal, saving: true, error: null });

    const { error } = await supabase.functions.invoke('create-teacher', {
      body: {
        nom: f.nom.trim(),
        postnom: f.postnom.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.password,
      },
    });

    if (error) {
      // Try to surface the function's JSON message.
      let detail = error.message;
      try {
        const body = await error.context.json();
        if (body?.message) detail = body.message;
      } catch {
        /* ignore */
      }
      const hint = String(detail).toLowerCase().includes('not found') || String(error.message).toLowerCase().includes('failed to send')
        ? " — La fonction « create-teacher » n'est peut-être pas encore déployée sur Supabase (voir supabase/functions/create-teacher)."
        : '';
      setCreateModal({ ...createModal, saving: false, error: detail + hint });
      return;
    }

    setCreateModal(null);
    setMsg({ type: 'success', text: 'Compte enseignant créé.' });
    load();
  }

  // ---- Assignments ----------------------------------------------------
  function openAssign(t) {
    setMsg(null);
    setAssignFor(t);
  }

  async function addAssignment(classeId, brancheId) {
    if (!classeId || !brancheId) return;
    const { error } = await supabase.from('enseignant_branches').insert({
      teacher_id: assignFor.id,
      classe_id: classeId,
      branche_id: brancheId,
      annee_scolaire: ecole?.annee_scolaire || '',
    });
    if (error) {
      setMsg({ type: 'error', text: error.message.includes('uq_affectation') ? 'Cette affectation existe déjà.' : error.message });
    } else {
      load();
    }
  }

  async function removeAssignment(id) {
    const { error } = await supabase.from('enseignant_branches').delete().eq('id', id);
    if (error) setMsg({ type: 'error', text: error.message });
    else load();
  }

  const name = (t) => `${t.nom} ${t.postnom || ''}`.trim();

  return (
    <AdminLayout title="Gestion des enseignants" subtitle="Créez les comptes enseignants et affectez-leur des matières par classe." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>＋ Nouvel enseignant</button>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{teachers.length} enseignant(s)</span>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : teachers.length === 0 ? (
        <div className="empty-state">Aucun enseignant. Cliquez sur « Nouvel enseignant ».</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Enseignant</th>
                <th>Email</th>
                <th>Affectations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td><strong>{name(t)}</strong></td>
                  <td>{t.email}</td>
                  <td>
                    {(affByTeacher[t.id] || []).length === 0 ? (
                      <span className="pill pill-gray">Aucune</span>
                    ) : (
                      <span className="pill pill-green">{(affByTeacher[t.id] || []).length} cours</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => openAssign(t)}>Gérer les affectations</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create teacher modal */}
      {createModal && (
        <Modal
          title="Nouvel enseignant"
          onClose={() => setCreateModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={createTeacher} disabled={createModal.saving}>
                {createModal.saving ? 'Création…' : 'Créer le compte'}
              </button>
            </>
          }
        >
          {createModal.error && <div className="alert-error">{createModal.error}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Nom <span className="req">*</span></label>
              <input className="input" value={createModal.form.nom} onChange={(e) => setCreateModal({ ...createModal, form: { ...createModal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Postnom</label>
              <input className="input" value={createModal.form.postnom} onChange={(e) => setCreateModal({ ...createModal, form: { ...createModal.form, postnom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Email <span className="req">*</span></label>
              <input className="input" type="email" value={createModal.form.email} onChange={(e) => setCreateModal({ ...createModal, form: { ...createModal.form, email: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Mot de passe <span className="req">*</span></label>
              <input className="input" type="text" placeholder="min. 6 caractères" value={createModal.form.password} onChange={(e) => setCreateModal({ ...createModal, form: { ...createModal.form, password: e.target.value } })} />
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            L'enseignant pourra se connecter immédiatement avec cet email et ce mot de passe.
          </p>
        </Modal>
      )}

      {/* Assignments modal */}
      {assignFor && (
        <AssignmentsModal
          teacher={assignFor}
          name={name(assignFor)}
          classes={classes}
          branches={branches}
          rows={affByTeacher[assignFor.id] || []}
          onAdd={addAssignment}
          onRemove={removeAssignment}
          onClose={() => setAssignFor(null)}
        />
      )}
    </AdminLayout>
  );
}

// --- Sub-component: assignment manager for one teacher -----------------
function AssignmentsModal({ teacher, name, classes, branches, rows, onAdd, onRemove, onClose }) {
  const [classeId, setClasseId] = useState('');
  const [brancheId, setBrancheId] = useState('');

  // Only show subjects belonging to the selected class's level.
  const selectedClasse = classes.find((c) => c.id === classeId);
  const filteredBranches = selectedClasse
    ? branches.filter((b) => b.niveau_id === selectedClasse.niveau_id)
    : [];

  return (
    <Modal
      title={`Affectations — ${name}`}
      onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Fermer</button>}
    >
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>Ajouter une affectation</h3>
      <div className="form-grid">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" value={classeId} onChange={(e) => { setClasseId(e.target.value); setBrancheId(''); }}>
            <option value="">— Choisir —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div>
          <label className="lbl">Matière</label>
          <select className="input" value={brancheId} onChange={(e) => setBrancheId(e.target.value)} disabled={!classeId}>
            <option value="">{classeId ? '— Choisir —' : "Choisissez d'abord une classe"}</option>
            {filteredBranches.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </div>
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ marginTop: 12 }}
        disabled={!classeId || !brancheId}
        onClick={() => { onAdd(classeId, brancheId); setBrancheId(''); }}
      >
        ＋ Ajouter
      </button>

      <h3 style={{ fontSize: 14, margin: '22px 0 10px' }}>Affectations actuelles</h3>
      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: 18 }}>Aucune affectation pour le moment.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Matière</th><th>Classe</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.branches?.nom}</strong></td>
                  <td>{r.classes?.nom}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => onRemove(r.id)}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
