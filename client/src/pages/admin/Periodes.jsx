// Academic periods — trimesters (primary) / semesters (secondary), with lock.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { defaultPeriodes, subPeriodes } from '../../data/defaults.js';
import { isLocked, GRACE_DAYS } from '../../lib/gradebook.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function Periodes() {
  const { ecole } = useEcole();
  const [niveaux, setNiveaux] = useState([]);
  const [niveauId, setNiveauId] = useState('');
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sous, setSous] = useState(null); // { periode, sps: [P1,P2] }

  // Open the sub-periods (P1/P2) editor; create them if missing.
  async function openSous(periode) {
    setMsg(null);
    let { data } = await supabase.from('sous_periodes').select('*').eq('periode_id', periode.id).order('numero');
    if (!data || data.length < 2) {
      const have = new Set((data || []).map((s) => s.numero));
      const toCreate = [1, 2].filter((n) => !have.has(n)).map((n) => ({ periode_id: periode.id, numero: n }));
      if (toCreate.length) await supabase.from('sous_periodes').insert(toCreate);
      data = (await supabase.from('sous_periodes').select('*').eq('periode_id', periode.id).order('numero')).data;
    }
    setSous({ periode, sps: data || [] });
  }

  async function saveSous(sp, patch) {
    const { error } = await supabase.from('sous_periodes').update(patch).eq('id', sp.id);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setSous((s) => ({ ...s, sps: s.sps.map((x) => (x.id === sp.id ? { ...x, ...patch } : x)) }));
  }

  const niveau = niveaux.find((n) => n.id === niveauId);

  useEffect(() => {
    supabase
      .from('niveaux')
      .select('id, nom, type, systeme_periodes')
      .order('nom')
      .then(({ data }) => {
        setNiveaux(data || []);
        if (data && data.length) setNiveauId(data[0].id);
      });
  }, []);

  async function loadPeriodes(id) {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from('periodes').select('*').eq('niveau_id', id).order('numero');
    setPeriodes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPeriodes(niveauId);
  }, [niveauId]);

  async function preload() {
    if (!niveau) return;
    if (!window.confirm(`Pré-charger les périodes par défaut pour « ${niveau.nom} » ?`)) return;
    const defs = defaultPeriodes(niveau.systeme_periodes);
    const rows = defs.map((d) => ({
      ...d,
      niveau_id: niveau.id,
      annee_scolaire: ecole?.annee_scolaire || '',
    }));
    const { error } = await supabase.from('periodes').insert(rows);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: `${rows.length} période(s) ajoutée(s).` });
      loadPeriodes(niveauId);
    }
  }

  function openCreate() {
    setMsg(null);
    setModal({
      edit: null,
      form: {
        nom: '',
        numero: periodes.length + 1,
        date_debut: '',
        date_fin: '',
        annee_scolaire: ecole?.annee_scolaire || '',
      },
    });
  }
  function openEdit(p) {
    setMsg(null);
    setModal({
      edit: p.id,
      form: {
        nom: p.nom,
        numero: p.numero,
        date_debut: p.date_debut || '',
        date_fin: p.date_fin || '',
        annee_scolaire: p.annee_scolaire,
      },
    });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim() || !f.numero) {
      setMsg({ type: 'error', text: 'Le nom et le numéro sont obligatoires.' });
      return;
    }
    setSaving(true);
    const payload = {
      nom: f.nom.trim(),
      type: niveau.systeme_periodes,
      niveau_id: niveauId,
      numero: Number(f.numero),
      annee_scolaire: f.annee_scolaire.trim() || ecole?.annee_scolaire || '',
      date_debut: f.date_debut || null,
      date_fin: f.date_fin || null,
    };
    let res;
    if (modal.edit) res = await supabase.from('periodes').update(payload).eq('id', modal.edit);
    else res = await supabase.from('periodes').insert(payload);
    setSaving(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
      return;
    }
    setModal(null);
    setMsg({ type: 'success', text: 'Période enregistrée.' });
    loadPeriodes(niveauId);
  }

  async function toggleLock(p) {
    const { error } = await supabase.from('periodes').update({ is_locked: !p.is_locked }).eq('id', p.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else loadPeriodes(niveauId);
  }

  async function remove(p) {
    if (!window.confirm(`Supprimer la période « ${p.nom} » ?`)) return;
    const { error } = await supabase.from('periodes').delete().eq('id', p.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'success', text: 'Période supprimée.' });
      loadPeriodes(niveauId);
    }
  }

  return (
    <AdminLayout title="Gestion des périodes" subtitle="Trimestres (primaire) ou semestres (secondaire). Verrouillez une période pour bloquer la saisie des notes." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Niveau</label>
          <select className="input" style={{ minWidth: 200 }} value={niveauId} onChange={(e) => setNiveauId(e.target.value)}>
            {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.systeme_periodes})</option>)}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline btn-sm" onClick={preload}>Pré-charger les périodes</button>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle période</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      <div className="locked-banner">
        Structure officielle : chaque trimestre/semestre = <strong>2 périodes de Travaux Journaliers</strong> + <strong>1 Examen</strong>.
        Au <strong>primaire</strong> : 3 trimestres (6 périodes) et <strong>3 examens</strong> (un par trimestre).
        Au <strong>secondaire</strong> : 2 semestres (4 périodes), <strong>2 examens</strong> (un par semestre) + un <strong>Examen de Repêchage</strong> de fin d'année.
        La saisie des notes (Phase 5) suivra exactement cette structure.
      </div>

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : periodes.length === 0 ? (
        <div className="empty-state">Aucune période. Utilisez « Pré-charger les périodes » pour démarrer.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 60 }}>N°</th>
                <th>Période</th>
                <th>Composition (Travaux Journaliers + Examen)</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {periodes.map((p) => (
                <tr key={p.id}>
                  <td>{p.numero}</td>
                  <td><strong>{p.nom}</strong></td>
                  <td>
                    {subPeriodes(p.numero).map((sp) => (
                      <span key={sp} className="pill pill-blue" style={{ marginRight: 6 }}>{sp}</span>
                    ))}
                    <span className="pill pill-gray">Examen</span>
                  </td>
                  <td>{p.date_debut || '—'}</td>
                  <td>{p.date_fin || '—'}</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={p.is_locked} onChange={() => toggleLock(p)} />
                      <span className="track" />
                      <span>{p.is_locked ? 'Verrouillée' : 'Ouverte'}</span>
                    </label>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openSous(p)}>Sous-périodes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Supprimer</button>
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
          title={modal.edit ? 'Modifier la période' : 'Nouvelle période'}
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
              <input className="input" placeholder="ex: 1er Trimestre" value={modal.form.nom} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Numéro <span className="req">*</span></label>
              <input className="input" type="number" min="1" value={modal.form.numero} onChange={(e) => setModal({ ...modal, form: { ...modal.form, numero: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Date de début</label>
              <input className="input" type="date" value={modal.form.date_debut} onChange={(e) => setModal({ ...modal, form: { ...modal.form, date_debut: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Date de fin</label>
              <input className="input" type="date" value={modal.form.date_fin} onChange={(e) => setModal({ ...modal, form: { ...modal.form, date_fin: e.target.value } })} />
            </div>
          </div>
        </Modal>
      )}

      {sous && (
        <Modal
          title={`Sous-périodes — ${sous.periode.nom}`}
          onClose={() => setSous(null)}
          footer={<button className="btn btn-primary" onClick={() => setSous(null)}>Fermer</button>}
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <p className="admin-sub" style={{ marginTop: 0 }}>
            Les travaux journaliers sont rangés en P1 ou P2 selon leur date. Verrouillage automatique {GRACE_DAYS} jours après la date de fin ; vous pouvez proclamer plus tôt ou rouvrir.
          </p>
          {sous.sps.map((sp) => {
            const locked = isLocked(sp);
            return (
              <div className="panel" key={sp.id} style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{sp.numero === 1 ? '1ère période (P1)' : '2ème période (P2)'}</strong>
                  <span className={'pill ' + (locked ? 'pill-red' : 'pill-green')}>{locked ? 'Verrouillée' : 'Ouverte'}</span>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="lbl">Début</label>
                    <input className="input" type="date" value={sp.date_debut || ''} onChange={(e) => saveSous(sp, { date_debut: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="lbl">Fin</label>
                    <input className="input" type="date" value={sp.date_fin || ''} onChange={(e) => saveSous(sp, { date_fin: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="lbl">Statut</label>
                    <select className="input" value={sp.statut} onChange={(e) => saveSous(sp, { statut: e.target.value })}>
                      <option value="auto">Automatique (verrou à la date + {GRACE_DAYS}j)</option>
                      <option value="proclamee">Proclamée (verrouillée maintenant)</option>
                      <option value="ouverte">Ouverte (forcée)</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </Modal>
      )}
    </AdminLayout>
  );
}
