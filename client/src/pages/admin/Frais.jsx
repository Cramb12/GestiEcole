// Director finance config — fee schedule (barème), discounts/exemptions, and
// finance settings (FC/USD rate, bulletin payment requirement).
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

const PERIODES = [
  ['unique', 'Frais unique'], ['mensuel', 'Mensuel'], ['trimestre', 'Trimestriel'],
  ['semestre', 'Semestriel'], ['annuel', 'Annuel'],
];
const perLabel = (p) => (PERIODES.find((x) => x[0] === p) || [, p])[1];

// Common DRC fee lines to pre-load (amounts left to the director).
const DEFAULTS = [
  { libelle: "Frais d'inscription", periodicite: 'unique' },
  { libelle: 'Minerval', periodicite: 'annuel' },
  { libelle: "Frais d'examen", periodicite: 'annuel' },
  { libelle: 'Informatique / connexion', periodicite: 'annuel' },
  { libelle: 'APE / COPA', periodicite: 'annuel' },
];

export default function Frais() {
  const { ecole, setEcole } = useEcole();
  const [tab, setTab] = useState('bareme');
  const [niveaux, setNiveaux] = useState([]);
  const [frais, setFrais] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Finance settings form.
  const [params, setParams] = useState({ taux_fc_usd: '', bulletin_exige_paiement: false });
  const [savingParams, setSavingParams] = useState(false);

  // Reductions tab.
  const [eleveId, setEleveId] = useState('');
  const [reductions, setReductions] = useState([]);
  const [redForm, setRedForm] = useState({ frais_id: '', pourcentage: '100', motif: '' });

  async function load() {
    setLoading(true);
    const [n, f, e] = await Promise.all([
      supabase.from('niveaux').select('id, nom').order('nom'),
      supabase.from('frais').select('*, niveaux(nom)').order('libelle'),
      supabase.from('eleves').select('id, nom, postnom, prenom').eq('actif', true).order('nom'),
    ]);
    setNiveaux(n.data || []);
    setFrais(f.data || []);
    setEleves(e.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (ecole) setParams({ taux_fc_usd: ecole.taux_fc_usd ?? '', bulletin_exige_paiement: !!ecole.bulletin_exige_paiement });
  }, [ecole]);

  async function saveParams() {
    if (!ecole?.id) return;
    setSavingParams(true); setMsg(null);
    const payload = {
      taux_fc_usd: params.taux_fc_usd === '' ? null : Number(params.taux_fc_usd),
      bulletin_exige_paiement: params.bulletin_exige_paiement,
    };
    const { error } = await supabase.from('ecole').update(payload).eq('id', ecole.id);
    setSavingParams(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    if (setEcole) setEcole({ ...ecole, ...payload });
    setMsg({ type: 'success', text: 'Paramètres enregistrés.' });
  }

  async function preload() {
    if (!window.confirm('Pré-charger les frais courants (montants à compléter ensuite) ?')) return;
    const rows = DEFAULTS.map((d) => ({ libelle: d.libelle, montant: 0, devise: 'USD', periodicite: d.periodicite, annee_scolaire: ecole?.annee_scolaire || null }));
    const { error } = await supabase.from('frais').insert(rows);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'success', text: `${rows.length} frais ajoutés. Complétez les montants.` }); load(); }
  }

  const openCreate = () => { setMsg(null); setModal({ edit: null, form: { libelle: '', montant: '', devise: 'USD', periodicite: 'annuel', niveau_id: '', actif: true } }); };
  const openEdit = (fr) => { setMsg(null); setModal({ edit: fr.id, form: { libelle: fr.libelle, montant: String(fr.montant), devise: fr.devise, periodicite: fr.periodicite, niveau_id: fr.niveau_id || '', actif: fr.actif } }); };

  async function saveFrais() {
    const f = modal.form;
    if (!f.libelle.trim()) { setMsg({ type: 'error', text: 'Le libellé est obligatoire.' }); return; }
    if (f.montant === '' || isNaN(Number(f.montant))) { setMsg({ type: 'error', text: 'Montant invalide.' }); return; }
    setSaving(true);
    const payload = {
      libelle: f.libelle.trim(), montant: Number(f.montant), devise: f.devise,
      periodicite: f.periodicite, niveau_id: f.niveau_id || null, actif: f.actif,
      annee_scolaire: ecole?.annee_scolaire || null,
    };
    const res = modal.edit
      ? await supabase.from('frais').update(payload).eq('id', modal.edit)
      : await supabase.from('frais').insert(payload);
    setSaving(false);
    if (res.error) { setMsg({ type: 'error', text: res.error.message }); return; }
    setModal(null); setMsg({ type: 'success', text: 'Frais enregistré.' }); load();
  }

  async function removeFrais(fr) {
    if (!window.confirm(`Supprimer « ${fr.libelle} » ? (Les paiements déjà enregistrés sont conservés.)`)) return;
    const { error } = await supabase.from('frais').delete().eq('id', fr.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'success', text: 'Frais supprimé.' }); load(); }
  }

  // ---- Réductions ----
  async function loadReductions(id) {
    if (!id) { setReductions([]); return; }
    const { data } = await supabase.from('frais_reductions').select('*, frais(libelle)').eq('eleve_id', id).order('created_at');
    setReductions(data || []);
  }
  useEffect(() => { loadReductions(eleveId); }, [eleveId]);

  async function addReduction() {
    if (!eleveId) { setMsg({ type: 'error', text: "Choisissez d'abord un élève." }); return; }
    const p = Number(redForm.pourcentage);
    if (isNaN(p) || p < 0 || p > 100) { setMsg({ type: 'error', text: 'Pourcentage entre 0 et 100.' }); return; }
    const { error } = await supabase.from('frais_reductions').insert({
      eleve_id: eleveId, frais_id: redForm.frais_id || null, pourcentage: p, motif: redForm.motif.trim() || null,
    });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setRedForm({ frais_id: '', pourcentage: '100', motif: '' });
    setMsg({ type: 'success', text: 'Réduction enregistrée.' });
    loadReductions(eleveId);
  }
  async function removeReduction(r) {
    const { error } = await supabase.from('frais_reductions').delete().eq('id', r.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else loadReductions(eleveId);
  }

  const eleveNom = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const upd = (k, v) => setModal({ ...modal, form: { ...modal.form, [k]: v } });

  return (
    <AdminLayout title="Frais & Barème" subtitle="Définissez les frais de l'école, les réductions et le taux de change." ecoleNom={ecole?.nom_ecole}>
      <div className="tabs">
        <button className={`tab ${tab === 'bareme' ? 'active' : ''}`} onClick={() => setTab('bareme')}>Barème & paramètres</button>
        <button className={`tab ${tab === 'reductions' ? 'active' : ''}`} onClick={() => setTab('reductions')}>Réductions / exonérations</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {tab === 'bareme' && (
        <>
          <div className="card-box">
            <h3 className="card-title">Paramètres finances</h3>
            <div className="form-grid">
              <div>
                <label className="lbl">Taux de change (FC pour 1 USD)</label>
                <input className="input" type="number" placeholder="ex: 2800" value={params.taux_fc_usd} onChange={(e) => setParams({ ...params, taux_fc_usd: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={params.bulletin_exige_paiement} onChange={(e) => setParams({ ...params, bulletin_exige_paiement: e.target.checked })} />
                  Exiger d'être en règle de paiement pour imprimer le bulletin
                </label>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveParams} disabled={savingParams}>{savingParams ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
          </div>

          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouveau frais</button>
            <button className="btn btn-outline btn-sm" onClick={preload}>Pré-charger les frais courants</button>
            <div className="spacer" />
            <span className="admin-sub" style={{ margin: 0 }}>{frais.length} frais</span>
          </div>

          {loading ? (
            <div className="empty-state">Chargement…</div>
          ) : frais.length === 0 ? (
            <div className="empty-state">Aucun frais. Utilisez « Pré-charger les frais courants » pour démarrer.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Libellé</th><th>Montant</th><th>Périodicité</th><th>Niveau</th><th>Actif</th><th></th></tr></thead>
                <tbody>
                  {frais.map((fr) => (
                    <tr key={fr.id}>
                      <td><strong>{fr.libelle}</strong></td>
                      <td>{Number(fr.montant).toLocaleString('fr-FR')} {fr.devise}</td>
                      <td>{perLabel(fr.periodicite)}</td>
                      <td>{fr.niveaux?.nom || 'Tous'}</td>
                      <td>{fr.actif ? <span className="pill pill-green">Actif</span> : <span className="pill pill-gray">Inactif</span>}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(fr)}>Modifier</button>
                          <button className="btn btn-danger btn-sm" onClick={() => removeFrais(fr)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'reductions' && (
        <>
          <div className="card-box">
            <h3 className="card-title">Réduction / exonération d'un élève</h3>
            <div className="field" style={{ maxWidth: 420 }}>
              <label className="lbl">Élève</label>
              <select className="input" value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
                <option value="">— Choisir un élève —</option>
                {eleves.map((e) => <option key={e.id} value={e.id}>{eleveNom(e)}</option>)}
              </select>
            </div>

            {eleveId && (
              <>
                <div className="form-grid" style={{ marginTop: 8 }}>
                  <div>
                    <label className="lbl">Frais concerné</label>
                    <select className="input" value={redForm.frais_id} onChange={(e) => setRedForm({ ...redForm, frais_id: e.target.value })}>
                      <option value="">Tous les frais</option>
                      {frais.map((fr) => <option key={fr.id} value={fr.id}>{fr.libelle}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Réduction (%) — 100 = exonéré</label>
                    <input className="input" type="number" min="0" max="100" value={redForm.pourcentage} onChange={(e) => setRedForm({ ...redForm, pourcentage: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">Motif</label>
                    <input className="input" placeholder="ex: Enfant d'enseignant, bourse…" value={redForm.motif} onChange={(e) => setRedForm({ ...redForm, motif: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={addReduction}>Ajouter la réduction</button>
              </>
            )}
          </div>

          {eleveId && (
            reductions.length === 0 ? (
              <div className="empty-state">Aucune réduction pour cet élève.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Frais</th><th>Réduction</th><th>Motif</th><th></th></tr></thead>
                  <tbody>
                    {reductions.map((r) => (
                      <tr key={r.id}>
                        <td>{r.frais?.libelle || 'Tous les frais'}</td>
                        <td>{r.pourcentage}%</td>
                        <td>{r.motif || '—'}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => removeReduction(r)}>Retirer</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {modal && (
        <Modal
          title={modal.edit ? 'Modifier le frais' : 'Nouveau frais'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveFrais} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </>}
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Libellé <span className="req">*</span></label>
              <input className="input" placeholder="ex: Minerval" value={modal.form.libelle} onChange={(e) => upd('libelle', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Montant <span className="req">*</span></label>
              <input className="input" type="number" placeholder="ex: 120" value={modal.form.montant} onChange={(e) => upd('montant', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Devise</label>
              <select className="input" value={modal.form.devise} onChange={(e) => upd('devise', e.target.value)}>
                <option value="USD">USD</option>
                <option value="FC">FC</option>
              </select>
            </div>
            <div>
              <label className="lbl">Périodicité</label>
              <select className="input" value={modal.form.periodicite} onChange={(e) => upd('periodicite', e.target.value)}>
                {PERIODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Niveau concerné</label>
              <select className="input" value={modal.form.niveau_id} onChange={(e) => upd('niveau_id', e.target.value)}>
                <option value="">Tous les niveaux</option>
                {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={modal.form.actif} onChange={(e) => upd('actif', e.target.checked)} /> Actif
              </label>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
