// Registrar (chargé des inscriptions) — manage students only: register, edit,
// assign to a class, activate/deactivate. No notes, bulletins or finances.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { fetchAll } from '../../lib/db.js';
import { provisionalPerm } from '../../lib/perm.js';
import InscripteurLayout from '../../components/InscripteurLayout.jsx';
import Modal from '../../components/Modal.jsx';

const EMPTY = {
  nom: '', postnom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '',
  ecole_provenance: '', telephone: '', numero_perm: '', classe_id: '', annee_scolaire: '',
};

export default function InscripteurEleves() {
  const { ecole } = useEcole();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [fClasse, setFClasse] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // { edit: id|null, form }
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [el, cl] = await Promise.all([
      fetchAll(() => supabase
        .from('eleves')
        .select('id, nom, postnom, prenom, sexe, date_naissance, lieu_naissance, numero_perm, telephone, classe_id, annee_scolaire, actif, classes(nom, niveaux(nom))')
        .order('nom').order('id')),
      supabase.from('classes').select('id, nom, niveau_id, niveaux(nom)').order('nom'),
    ]);
    setEleves(el || []);
    setClasses(cl.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return eleves.filter((e) => {
      if (fClasse && e.classe_id !== fClasse) return false;
      if (!nq) return true;
      const hay = `${e.nom} ${e.postnom || ''} ${e.prenom || ''} ${e.numero_perm || ''}`.toLowerCase();
      return hay.includes(nq);
    });
  }, [eleves, fClasse, q]);

  function openNew() {
    setMsg(null);
    setModal({ edit: null, form: { ...EMPTY, annee_scolaire: ecole?.annee_scolaire || '' } });
  }
  function openEdit(e) {
    setMsg(null);
    setModal({
      edit: e.id,
      form: {
        nom: e.nom || '', postnom: e.postnom || '', prenom: e.prenom || '',
        sexe: e.sexe || '', date_naissance: e.date_naissance || '', lieu_naissance: e.lieu_naissance || '',
        ecole_provenance: e.ecole_provenance || '', telephone: e.telephone || '',
        numero_perm: e.numero_perm || '', classe_id: e.classe_id || '', annee_scolaire: e.annee_scolaire || '',
      },
    });
  }
  const set = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

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

    // N° PERM optional: empty = auto-generate a unique provisional one.
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
      if (dup && generated) continue; // rare generated collision — retry
      setSaving(false);
      setMsg({ type: 'error', text: dup ? 'Ce numéro PERM existe déjà pour cette année.' : res.error.message });
      return;
    }
  }

  async function toggleActif(e) {
    const { error } = await supabase.from('eleves').update({ actif: !e.actif }).eq('id', e.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else load();
  }

  const name = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.trim();

  return (
    <InscripteurLayout title="Inscriptions des élèves" subtitle="Inscrivez les élèves et affectez-les à une classe.">
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nouvel élève</button>
        <select className="input" style={{ maxWidth: 220 }} value={fClasse} onChange={(e) => setFClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
        </select>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Rechercher (nom, PERM)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <span className="admin-sub" style={{ margin: 0 }}>{filtered.length} élève(s)</span>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">Aucun élève. Cliquez sur « Nouvel élève ».</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Élève</th><th>N° PERM</th><th>Classe</th><th>Sexe</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} style={e.actif ? undefined : { opacity: 0.5 }}>
                  <td><strong>{name(e)}</strong>{!e.actif && <span className="pill pill-gray" style={{ marginLeft: 6 }}>inactif</span>}</td>
                  <td>{e.numero_perm}</td>
                  <td>{e.classes?.nom || '—'}</td>
                  <td>{e.sexe || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>Modifier</button>{' '}
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActif(e)}>{e.actif ? 'Désactiver' : 'Réactiver'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title={modal.edit ? 'Modifier l’élève' : 'Nouvel élève'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </>
          }
        >
          <div className="form-grid">
            <div>
              <label className="lbl">Nom <span className="req">*</span></label>
              <input className="input" value={modal.form.nom} onChange={(e) => set('nom', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Postnom</label>
              <input className="input" value={modal.form.postnom} onChange={(e) => set('postnom', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Prénom</label>
              <input className="input" value={modal.form.prenom} onChange={(e) => set('prenom', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Sexe</label>
              <select className="input" value={modal.form.sexe} onChange={(e) => set('sexe', e.target.value)}>
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="lbl">Date de naissance</label>
              <input className="input" type="date" value={modal.form.date_naissance} onChange={(e) => set('date_naissance', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Lieu de naissance</label>
              <input className="input" value={modal.form.lieu_naissance} onChange={(e) => set('lieu_naissance', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Classe <span className="req">*</span></label>
              <select className="input" value={modal.form.classe_id} onChange={(e) => set('classe_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Année scolaire <span className="req">*</span></label>
              <input className="input" value={modal.form.annee_scolaire} onChange={(e) => set('annee_scolaire', e.target.value)} />
            </div>
            <div>
              <label className="lbl">École de provenance</label>
              <input className="input" value={modal.form.ecole_provenance} onChange={(e) => set('ecole_provenance', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Téléphone (tuteur)</label>
              <input className="input" value={modal.form.telephone} onChange={(e) => set('telephone', e.target.value)} />
            </div>
            <div>
              <label className="lbl">N° PERM</label>
              <input className="input" placeholder="Laisser vide = provisoire généré" value={modal.form.numero_perm} onChange={(e) => set('numero_perm', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </InscripteurLayout>
  );
}
