// Students management — list, filters, search, enrollment, CSV import.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { parseCSV, downloadCSV } from '../../lib/csv.js';
import { provisionalPerm } from '../../lib/perm.js';
import { fetchAll } from '../../lib/db.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

const EMPTY = {
  nom: '',
  postnom: '',
  prenom: '',
  sexe: '',
  date_naissance: '',
  lieu_naissance: '',
  numero_perm: '',
  ecole_provenance: '',
  telephone: '',
  classe_id: '',
  annee_scolaire: '',
};

export default function Eleves() {
  const { ecole } = useEcole();
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Filters
  const [fNiveau, setFNiveau] = useState('');
  const [fClasse, setFClasse] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [modal, setModal] = useState(null); // enrollment (create/edit)
  const [saving, setSaving] = useState(false);
  const [importModal, setImportModal] = useState(null);

  async function load() {
    setLoading(true);
    const [el, cl, nv] = await Promise.all([
      fetchAll(() => supabase
        .from('eleves')
        .select('id, nom, postnom, prenom, sexe, date_naissance, lieu_naissance, numero_perm, telephone, classe_id, annee_scolaire, actif, classes(nom, niveau_id, niveaux(nom))')
        .order('nom').order('id')),
      supabase.from('classes').select('id, nom, niveau_id, niveaux(nom), sections(nom)').order('nom'),
      supabase.from('niveaux').select('id, nom').order('nom'),
    ]);
    setEleves(el || []);
    setClasses(cl.data || []);
    setNiveaux(nv.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Classes available in the filter (optionally narrowed by level).
  const filterClasses = fNiveau ? classes.filter((c) => c.niveau_id === fNiveau) : classes;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eleves.filter((e) => {
      if (fClasse && e.classe_id !== fClasse) return false;
      if (fNiveau && e.classes?.niveau_id !== fNiveau) return false;
      if (q) {
        const hay = `${e.nom} ${e.postnom || ''} ${e.prenom || ''} ${e.numero_perm}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eleves, fClasse, fNiveau, search]);

  function openCreate() {
    setMsg(null);
    setModal({ edit: null, form: { ...EMPTY, annee_scolaire: ecole?.annee_scolaire || '' } });
  }
  function openEdit(e) {
    setMsg(null);
    setModal({
      edit: e.id,
      form: {
        nom: e.nom,
        postnom: e.postnom || '',
        prenom: e.prenom || '',
        sexe: e.sexe || '',
        date_naissance: e.date_naissance || '',
        lieu_naissance: e.lieu_naissance || '',
        numero_perm: e.numero_perm,
        ecole_provenance: e.ecole_provenance || '',
        telephone: e.telephone || '',
        classe_id: e.classe_id || '',
        annee_scolaire: e.annee_scolaire,
      },
    });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim() || !f.classe_id || !f.annee_scolaire.trim()) {
      setMsg({ type: 'error', text: 'Nom, classe et année scolaire sont obligatoires.' });
      return;
    }
    setSaving(true);

    const base = {
      nom: f.nom.trim(),
      postnom: f.postnom.trim() || null,
      prenom: f.prenom.trim() || null,
      sexe: f.sexe || null,
      date_naissance: f.date_naissance || null,
      lieu_naissance: f.lieu_naissance.trim() || null,
      ecole_provenance: f.ecole_provenance.trim() || null,
      telephone: f.telephone.trim() || null,
      classe_id: f.classe_id,
      annee_scolaire: f.annee_scolaire.trim(),
    };

    // N° PERM optional: if empty, auto-generate a unique provisional one.
    const typed = f.numero_perm.trim();
    const generated = !typed;

    for (let attempt = 0; attempt < 4; attempt++) {
      const perm = generated ? provisionalPerm(base.annee_scolaire) : typed;
      const payload = { ...base, numero_perm: perm };
      const res = modal.edit
        ? await supabase.from('eleves').update(payload).eq('id', modal.edit)
        : await supabase.from('eleves').insert(payload);

      if (!res.error) {
        setSaving(false);
        setModal(null);
        setMsg({ type: 'success', text: 'Élève enregistré.' });
        load();
        return;
      }
      const dup = res.error.message.includes('uq_eleve_perm_annee');
      // A generated collision is extremely rare — just retry with a new id.
      if (dup && generated) continue;
      setSaving(false);
      setMsg({
        type: 'error',
        text: dup ? `Le N° PERM « ${typed} » existe déjà pour cette année.` : res.error.message,
      });
      return;
    }
    setSaving(false);
    setMsg({ type: 'error', text: 'Impossible de générer un N° PERM unique. Réessayez.' });
  }

  async function remove(e) {
    if (!window.confirm(`Supprimer l'élève « ${e.nom} ${e.postnom || ''} » ?`)) return;
    const { error } = await supabase.from('eleves').delete().eq('id', e.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Élève supprimé.' });
      load();
    }
  }

  function downloadTemplate() {
    const header = 'nom,postnom,prenom,sexe,date_naissance,lieu_naissance,numero_perm,ecole_provenance,telephone,classe,annee_scolaire';
    const example = `Mukendi,Kabongo,Grace,F,2015-04-12,Bukavu,PERM-001,,1ère A,${ecole?.annee_scolaire || '2025-2026'}`;
    downloadCSV('modele_eleves.csv', header + '\n' + example + '\n');
  }

  const fullName = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

  return (
    <AdminLayout title="Gestion des élèves" subtitle="Inscrivez, recherchez et gérez les élèves de l'école." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvel élève</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setMsg(null); setImportModal({}); }}>Importer (CSV)</button>
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>Télécharger le modèle</button>
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{filtered.length} / {eleves.length} élève(s)</span>
      </div>

      {/* Filters */}
      <div className="panel" style={{ padding: 14 }}>
        <div className="form-grid">
          <div>
            <label className="lbl">Niveau</label>
            <select className="input" value={fNiveau} onChange={(e) => { setFNiveau(e.target.value); setFClasse(''); }}>
              <option value="">Tous les niveaux</option>
              {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Classe</label>
            <select className="input" value={fClasse} onChange={(e) => setFClasse(e.target.value)}>
              <option value="">Toutes les classes</option>
              {filterClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Recherche (nom ou N° PERM)</label>
            <input className="input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {eleves.length === 0 ? "Aucun élève inscrit. Cliquez sur « Nouvel élève » ou importez un fichier CSV." : 'Aucun élève ne correspond à votre recherche.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nom complet</th>
                <th>Sexe</th>
                <th>N° PERM</th>
                <th>Classe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td><strong>{fullName(e)}</strong>{!e.actif && <span className="pill pill-red" style={{ marginLeft: 8 }}>Inactif</span>}</td>
                  <td>{e.sexe || '—'}</td>
                  <td>{e.numero_perm}</td>
                  <td>{e.classes ? <span className="pill pill-blue">{e.classes.nom}</span> : <span className="admin-sub" style={{ margin: 0 }}>—</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/eleves/${e.id}`)}>Profil</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(e)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <EnrollModal
          modal={modal}
          setModal={setModal}
          classes={classes}
          saving={saving}
          onSave={save}
          error={msg && msg.type === 'error' ? msg.text : null}
        />
      )}

      {importModal && (
        <ImportModal
          classes={classes}
          defaultAnnee={ecole?.annee_scolaire || ''}
          onClose={() => setImportModal(null)}
          onDone={(summary) => {
            setImportModal(null);
            setMsg({ type: summary.errors.length ? 'error' : 'success', text: summary.text });
            load();
          }}
        />
      )}
    </AdminLayout>
  );
}

// --- Enrollment modal (create / edit) ---------------------------------
function EnrollModal({ modal, setModal, classes, saving, onSave, error }) {
  const set = (field, value) => setModal({ ...modal, form: { ...modal.form, [field]: value } });
  const f = modal.form;
  return (
    <Modal
      title={modal.edit ? "Modifier l'élève" : 'Nouvel élève'}
      onClose={() => setModal(null)}
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>
      }
    >
      {error && <div className="alert-error">{error}</div>}
      <div className="form-grid">
        <div>
          <label className="lbl">Nom <span className="req">*</span></label>
          <input className="input" value={f.nom} onChange={(e) => set('nom', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Postnom</label>
          <input className="input" value={f.postnom} onChange={(e) => set('postnom', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Prénom</label>
          <input className="input" value={f.prenom} onChange={(e) => set('prenom', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Sexe</label>
          <select className="input" value={f.sexe} onChange={(e) => set('sexe', e.target.value)}>
            <option value="">—</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
        <div>
          <label className="lbl">Date de naissance</label>
          <input className="input" type="date" value={f.date_naissance} onChange={(e) => set('date_naissance', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Lieu de naissance</label>
          <input className="input" value={f.lieu_naissance} onChange={(e) => set('lieu_naissance', e.target.value)} />
        </div>
        <div>
          <label className="lbl">N° PERM (SERNIE)</label>
          <input className="input" placeholder="Laisser vide = provisoire généré" value={f.numero_perm} onChange={(e) => set('numero_perm', e.target.value)} />
        </div>
        <div>
          <label className="lbl">École de provenance</label>
          <input className="input" placeholder="Si l'élève vient d'une autre école" value={f.ecole_provenance} onChange={(e) => set('ecole_provenance', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Téléphone parent / tuteur</label>
          <input className="input" placeholder="ex: +243 99 000 0000 (pour les rappels)" value={f.telephone} onChange={(e) => set('telephone', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Classe <span className="req">*</span></label>
          <select className="input" value={f.classe_id} onChange={(e) => set('classe_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom}{c.sections ? ' - ' + c.sections.nom : ''})</option>)}
          </select>
        </div>
        <div>
          <label className="lbl">Année scolaire <span className="req">*</span></label>
          <input className="input" value={f.annee_scolaire} onChange={(e) => set('annee_scolaire', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// --- CSV import modal -------------------------------------------------
function ImportModal({ classes, defaultAnnee, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result));
        if (parsed.length === 0) setError('Le fichier est vide.');
        setRows(parsed);
      } catch (err) {
        setError('Fichier illisible : ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function doImport() {
    setBusy(true);
    const byName = {};
    classes.forEach((c) => (byName[c.nom.toLowerCase().trim()] = c.id));
    let ok = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ligne = i + 2; // +1 header +1 1-based
      if (!r.nom || !r.classe) {
        errors.push(`Ligne ${ligne}: nom et classe sont requis.`);
        continue;
      }
      const classeId = byName[String(r.classe).toLowerCase().trim()];
      if (!classeId) {
        errors.push(`Ligne ${ligne}: classe « ${r.classe} » introuvable.`);
        continue;
      }
      const annee = r.annee_scolaire || defaultAnnee;
      const payload = {
        nom: r.nom,
        postnom: r.postnom || null,
        prenom: r.prenom || null,
        sexe: r.sexe === 'M' || r.sexe === 'F' ? r.sexe : null,
        date_naissance: r.date_naissance || null,
        lieu_naissance: r.lieu_naissance || null,
        // N° PERM optional: generate a provisional one when missing.
        numero_perm: r.numero_perm || provisionalPerm(annee),
        ecole_provenance: r.ecole_provenance || null,
        telephone: r.telephone || null,
        classe_id: classeId,
        annee_scolaire: annee,
      };
      const { error } = await supabase.from('eleves').insert(payload);
      if (error) {
        errors.push(
          `Ligne ${ligne} (${r.numero_perm}): ${error.message.includes('uq_eleve_perm_annee') ? 'N° PERM déjà existant' : error.message}`
        );
      } else ok++;
    }

    setBusy(false);
    onDone({
      errors,
      text: `${ok} élève(s) importé(s).` + (errors.length ? ` ${errors.length} erreur(s) : ` + errors.slice(0, 5).join(' | ') + (errors.length > 5 ? '…' : '') : ''),
    });
  }

  return (
    <Modal
      title="Importer des élèves (CSV)"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={doImport} disabled={!rows || !rows.length || busy}>
            {busy ? 'Importation…' : rows ? `Importer ${rows.length} ligne(s)` : 'Importer'}
          </button>
        </>
      }
    >
      {error && <div className="alert-error">{error}</div>}
      <p className="admin-sub" style={{ marginTop: 0 }}>
        Colonnes attendues : <code>nom, postnom, prenom, sexe, date_naissance, lieu_naissance, numero_perm, ecole_provenance, classe, annee_scolaire</code>.
        La colonne « classe » doit correspondre au nom exact d'une classe existante.
        Le <code>numero_perm</code> est <strong>optionnel</strong> : laissé vide, un numéro provisoire est généré.
      </p>
      <input type="file" accept=".csv,text/csv" onChange={handleFile} />
      {rows && !error && (
        <div className="alert-success" style={{ marginTop: 14 }}>
          {rows.length} ligne(s) détectée(s), prêtes à importer.
        </div>
      )}
    </Modal>
  );
}
