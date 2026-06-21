// Teachers management — create accounts (via Edge Function) + assignments.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { downloadCSV } from '../../lib/csv.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';
import CsvImportModal from '../../components/CsvImportModal.jsx';

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
  const [importKind, setImportKind] = useState(null); // 'comptes' | 'affectations'

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

  // ---- CSV imports ----------------------------------------------------
  function dlComptes() {
    downloadCSV('modele_enseignants_comptes.csv', 'nom,postnom,email,password\nKalala,Mbuyi,j.kalala@ecole.cd,prof2025\n');
  }
  function dlAffectations() {
    downloadCSV('modele_affectations.csv', 'email,matiere,classe\nj.kalala@ecole.cd,Mathématiques,1ère Hum. Scientifique\n');
  }

  // Create teacher accounts in bulk (via the create-teacher Edge Function).
  async function importComptes(rows) {
    let ok = 0; const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const ligne = i + 2;
      if (!r.nom || !r.email || !r.password) { errors.push(`Ligne ${ligne}: nom, email, password requis.`); continue; }
      if (String(r.password).length < 6) { errors.push(`Ligne ${ligne}: mot de passe trop court (min. 6).`); continue; }
      const { error } = await supabase.functions.invoke('create-teacher', { body: { nom: r.nom, postnom: r.postnom || '', email: String(r.email).toLowerCase().trim(), password: r.password } });
      if (error) {
        let d = error.message; try { const b = await error.context.json(); if (b?.message) d = b.message; } catch { /* ignore */ }
        errors.push(`Ligne ${ligne} (${r.email}): ${d}`);
      } else ok++;
    }
    return { ok, errors };
  }

  // Assign subjects to teachers in bulk (email + matière + classe).
  async function importAffectations(rows) {
    let ok = 0; const errors = [];
    const byEmail = {}; teachers.forEach((t) => (byEmail[(t.email || '').toLowerCase().trim()] = t.id));
    const clByName = {}; classes.forEach((c) => (clByName[c.nom.toLowerCase().trim()] = c));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const ligne = i + 2;
      if (!r.email || !r.matiere || !r.classe) { errors.push(`Ligne ${ligne}: email, matiere, classe requis.`); continue; }
      const tid = byEmail[String(r.email).toLowerCase().trim()];
      if (!tid) { errors.push(`Ligne ${ligne}: enseignant « ${r.email} » introuvable.`); continue; }
      const cl = clByName[String(r.classe).toLowerCase().trim()];
      if (!cl) { errors.push(`Ligne ${ligne}: classe « ${r.classe} » introuvable.`); continue; }
      const br = branches.find((b) => b.niveau_id === cl.niveau_id && b.nom.toLowerCase().trim() === String(r.matiere).toLowerCase().trim());
      if (!br) { errors.push(`Ligne ${ligne}: matière « ${r.matiere} » introuvable pour ce niveau.`); continue; }
      const { error } = await supabase.from('enseignant_branches').upsert({ teacher_id: tid, branche_id: br.id, classe_id: cl.id, annee_scolaire: ecole?.annee_scolaire || '' }, { onConflict: 'teacher_id,branche_id,classe_id,annee_scolaire' });
      if (error) errors.push(`Ligne ${ligne}: ${error.message}`); else ok++;
    }
    return { ok, errors };
  }

  const name = (t) => `${t.nom} ${t.postnom || ''}`.trim();

  return (
    <AdminLayout title="Gestion des enseignants" subtitle="Créez les comptes enseignants et affectez-leur des matières par classe." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvel enseignant</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setMsg(null); setImportKind('comptes'); }}>Importer comptes (CSV)</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setMsg(null); setImportKind('affectations'); }}>Importer affectations (CSV)</button>
        <button className="btn btn-secondary btn-sm" onClick={dlComptes}>Modèle comptes</button>
        <button className="btn btn-secondary btn-sm" onClick={dlAffectations}>Modèle affectations</button>
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

      {/* CSV import modals */}
      {importKind === 'comptes' && (
        <CsvImportModal
          title="Importer des comptes enseignants (CSV)"
          expected="nom, postnom, email, password"
          note="Chaque ligne crée un compte de connexion (mot de passe ≥ 6 caractères)."
          onImport={importComptes}
          onClose={() => setImportKind(null)}
          onDone={load}
        />
      )}
      {importKind === 'affectations' && (
        <CsvImportModal
          title="Importer des affectations (CSV)"
          expected="email, matiere, classe"
          note="L'email doit correspondre à un enseignant existant ; la classe et la matière à des noms exacts."
          onImport={importAffectations}
          onClose={() => setImportKind(null)}
          onDone={load}
        />
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
        + Ajouter
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
