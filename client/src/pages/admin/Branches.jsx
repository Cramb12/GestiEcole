// Subjects (matières) management, organised by official programme
// (niveau + section + année). Courses/maxima can be pre-loaded from the
// official MINEDUC bulletins (loaded dynamically to keep the app light).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

const CATEGORY = { elementaire: 'Primaire', moyen: 'Primaire', terminal: 'Primaire', cteb: "Cycle d'Orientation", humanites: 'Humanités' };

export default function Branches() {
  const { ecole } = useEcole();
  const [programmes, setProgrammes] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [sections, setSections] = useState([]);
  const [key, setKey] = useState('');
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preloading, setPreloading] = useState(false);

  // Load reference data + the (heavy) official programmes file dynamically.
  useEffect(() => {
    (async () => {
      const [nv, sec, mod] = await Promise.all([
        supabase.from('niveaux').select('id, nom, bulletin_template'),
        supabase.from('sections').select('id, nom').order('nom'),
        import('../../data/programmes.js'),
      ]);
      setNiveaux(nv.data || []);
      setSections(sec.data || []);
      setProgrammes(mod.PROGRAMMES || []);
      if (mod.PROGRAMMES?.length) setKey(mod.PROGRAMMES[0].key);
    })();
  }, []);

  const prog = useMemo(() => programmes.find((p) => p.key === key), [programmes, key]);

  // Resolve the programme to concrete niveau/section/année.
  const resolved = useMemo(() => {
    if (!prog) return null;
    const niveau = niveaux.find((n) => n.bulletin_template === prog.template);
    const section = prog.section ? sections.find((s) => s.nom === prog.section) : null;
    return {
      niveau_id: niveau?.id || null,
      section_id: section?.id || null,
      sectionMissing: !!prog.section && !section,
      annee: prog.annee || null,
    };
  }, [prog, niveaux, sections]);

  async function loadBranches() {
    if (!resolved?.niveau_id) { setBranches([]); return; }
    setLoading(true);
    let q = supabase.from('branches').select('*').eq('niveau_id', resolved.niveau_id);
    q = resolved.section_id ? q.eq('section_id', resolved.section_id) : q.is('section_id', null);
    q = resolved.annee ? q.eq('annee', resolved.annee) : q.is('annee', null);
    const { data } = await q.order('ordre').order('nom');
    setBranches(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (prog) loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resolved?.niveau_id, resolved?.section_id, resolved?.annee]);

  async function preload() {
    if (!prog || !resolved?.niveau_id) return;
    if (resolved.sectionMissing) {
      setMsg({ type: 'error', text: `Créez d'abord la section « ${prog.section} » dans « Sections ».` });
      return;
    }
    const existingNames = new Set(branches.map((b) => b.nom.toLowerCase()));
    const rows = prog.courses
      .filter((c) => !existingNames.has(c.nom.toLowerCase()))
      .map((c, i) => ({
        nom: c.nom,
        domaine: c.domaine || null,
        sous_domaine: c.sous || null,
        max_points: c.max,
        niveau_id: resolved.niveau_id,
        section_id: resolved.section_id,
        annee: resolved.annee,
        ordre: branches.length + i + 1,
      }));
    if (rows.length === 0) {
      setMsg({ type: 'error', text: 'Toutes les matières de ce programme sont déjà chargées.' });
      return;
    }
    setPreloading(true);
    const { error } = await supabase.from('branches').insert(rows);
    setPreloading(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'success', text: `${rows.length} matière(s) chargée(s) depuis le programme officiel.` });
    loadBranches();
  }

  function openCreate() {
    setMsg(null);
    setModal({ edit: null, form: { nom: '', domaine: '', sous_domaine: '', max_points: 20, ordre: branches.length + 1 } });
  }
  function openEdit(b) {
    setMsg(null);
    setModal({ edit: b.id, form: { nom: b.nom, domaine: b.domaine || '', sous_domaine: b.sous_domaine || '', max_points: b.max_points, ordre: b.ordre } });
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim()) { setMsg({ type: 'error', text: 'Le nom de la matière est obligatoire.' }); return; }
    if (resolved.sectionMissing) { setMsg({ type: 'error', text: `Créez d'abord la section « ${prog.section} ».` }); return; }
    setSaving(true);
    const payload = {
      nom: f.nom.trim(),
      domaine: f.domaine.trim() || null,
      sous_domaine: f.sous_domaine.trim() || null,
      max_points: Number(f.max_points) || 0,
      ordre: Number(f.ordre) || 0,
      niveau_id: resolved.niveau_id,
      section_id: resolved.section_id,
      annee: resolved.annee,
    };
    const res = modal.edit
      ? await supabase.from('branches').update(payload).eq('id', modal.edit)
      : await supabase.from('branches').insert(payload);
    setSaving(false);
    if (res.error) { setMsg({ type: 'error', text: res.error.message }); return; }
    setModal(null);
    setMsg({ type: 'success', text: 'Matière enregistrée.' });
    loadBranches();
  }

  async function remove(b) {
    if (!window.confirm(`Supprimer la matière « ${b.nom} » ?`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', b.id);
    if (error) setMsg({ type: 'error', text: error.message });
    else { setMsg({ type: 'success', text: 'Matière supprimée.' }); loadBranches(); }
  }

  // Group programmes by category for the dropdown.
  const grouped = useMemo(() => {
    const g = {};
    programmes.forEach((p) => { (g[CATEGORY[p.template] || 'Autre'] ||= []).push(p); });
    return g;
  }, [programmes]);

  return (
    <AdminLayout title="Gestion des matières" subtitle="Par programme (niveau, section, année). Pré-chargez les cours et maxima officiels, puis ajustez si besoin." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Programme</label>
          <select className="input" style={{ minWidth: 320 }} value={key} onChange={(e) => setKey(e.target.value)}>
            {Object.entries(grouped).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline btn-sm" onClick={preload} disabled={preloading}>
          {preloading ? 'Chargement…' : 'Pré-charger ce programme (officiel)'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle matière</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}
      {resolved?.sectionMissing && (
        <div className="locked-banner">Ce programme concerne la section « {prog.section} » : créez-la d'abord dans « Sections » pour pouvoir charger ses matières.</div>
      )}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : branches.length === 0 ? (
        <div className="empty-state">
          Aucune matière pour ce programme.<br />
          Cliquez sur « Pré-charger ce programme (officiel) » pour charger la liste exacte.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Domaine</th>
                <th>Sous-groupe</th>
                <th>Matière</th>
                <th style={{ width: 110 }}>Max / période</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td>{b.ordre}</td>
                  <td><span className="admin-sub" style={{ margin: 0 }}>{b.domaine || '—'}</span></td>
                  <td>{b.sous_domaine || '—'}</td>
                  <td><strong>{b.nom}</strong></td>
                  <td>{b.max_points}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>Supprimer</button>
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
          title={modal.edit ? 'Modifier la matière' : 'Nouvelle matière'}
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
              <label className="lbl">Matière <span className="req">*</span></label>
              <input className="input" value={modal.form.nom} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nom: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Domaine</label>
              <input className="input" value={modal.form.domaine} onChange={(e) => setModal({ ...modal, form: { ...modal.form, domaine: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Sous-groupe</label>
              <input className="input" placeholder="ex: FRANÇAIS" value={modal.form.sous_domaine} onChange={(e) => setModal({ ...modal, form: { ...modal.form, sous_domaine: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Max / période <span className="req">*</span></label>
              <input className="input" type="number" min="0" value={modal.form.max_points} onChange={(e) => setModal({ ...modal, form: { ...modal.form, max_points: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Ordre</label>
              <input className="input" type="number" min="0" value={modal.form.ordre} onChange={(e) => setModal({ ...modal, form: { ...modal.form, ordre: e.target.value } })} />
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
