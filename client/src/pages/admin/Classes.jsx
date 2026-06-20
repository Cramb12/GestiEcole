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
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [counts, setCounts] = useState({}); // classe_id -> nb élèves
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [modal, setModal] = useState(null); // null | {edit?, form}
  const [saving, setSaving] = useState(false);
  const [preload, setPreload] = useState(null); // standard-classes generator
  const [preloading, setPreloading] = useState(false);

  async function load() {
    setLoading(true);
    const [cl, nv, sec, tc, el] = await Promise.all([
      supabase.from('classes').select('id, nom, annee, annee_scolaire, niveau_id, titulaire_id, section_id, niveaux(nom, bulletin_template), profiles(nom, postnom), sections(nom)').order('nom'),
      supabase.from('niveaux').select('id, nom, type, bulletin_template').order('nom'),
      supabase.from('sections').select('id, nom').order('nom'),
      supabase.from('profiles').select('id, nom, postnom').eq('role', 'teacher').order('nom'),
      supabase.from('eleves').select('classe_id'),
    ]);
    setClasses(cl.data || []);
    setNiveaux(nv.data || []);
    setSections(sec.data || []);
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
      form: { nom: '', niveau_id: '', titulaire_id: '', section_id: '', annee: '', annee_scolaire: ecole?.annee_scolaire || '' },
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
        section_id: c.section_id || '',
        annee: c.annee || '',
        annee_scolaire: c.annee_scolaire,
      },
    });
  }

  function openPreload() {
    setMsg(null);
    setPreload({ primaire: true, co: true, sectionIds: [], annee: ecole?.annee_scolaire || '' });
  }

  // Generate the standard class structure from the official DRC degrees.
  async function doPreload() {
    const p = preload;
    if (!p.annee.trim()) {
      setMsg({ type: 'error', text: "Indiquez l'année scolaire." });
      return;
    }
    const byTpl = {};
    niveaux.forEach((n) => (byTpl[n.bulletin_template] = n.id));
    const secById = {};
    sections.forEach((s) => (secById[s.id] = s.nom));

    const rows = [];
    if (p.primaire) {
      [['1ère année', 'elementaire', '1'], ['2ème année', 'elementaire', '2'], ['3ème année', 'moyen', '3'],
       ['4ème année', 'moyen', '4'], ['5ème année', 'terminal', '5'], ['6ème année', 'terminal', '6']]
        .forEach(([nom, tpl, an]) => { if (byTpl[tpl]) rows.push({ nom, niveau_id: byTpl[tpl], section_id: null, annee: an, annee_scolaire: p.annee.trim() }); });
    }
    if (p.co && byTpl.cteb) {
      [['7ème année', '7'], ['8ème année', '8']].forEach(([nom, an]) => rows.push({ nom, niveau_id: byTpl.cteb, section_id: null, annee: an, annee_scolaire: p.annee.trim() }));
    }
    if (p.sectionIds.length && byTpl.humanites) {
      p.sectionIds.forEach((sid) => {
        [['1ère', '1'], ['2ème', '2'], ['3ème', '3'], ['4ème', '4']].forEach(([y, an]) =>
          rows.push({ nom: `${y} Hum. ${secById[sid]}`, niveau_id: byTpl.humanites, section_id: sid, annee: an, annee_scolaire: p.annee.trim() }));
      });
    }

    // Skip classes that already exist (same name + year).
    const existing = new Set(classes.map((c) => `${c.nom}|${c.annee_scolaire}`));
    const toInsert = rows.filter((r) => !existing.has(`${r.nom}|${r.annee_scolaire}`));

    if (toInsert.length === 0) {
      setMsg({ type: 'error', text: 'Rien à créer (ces classes existent déjà ou aucune option sélectionnée).' });
      return;
    }
    setPreloading(true);
    const { error } = await supabase.from('classes').insert(toInsert);
    setPreloading(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setPreload(null);
    setMsg({ type: 'success', text: `${toInsert.length} classe(s) créée(s).` });
    load();
  }

  async function save() {
    const f = modal.form;
    if (!f.nom.trim() || !f.niveau_id || !f.annee_scolaire.trim()) {
      setMsg({ type: 'error', text: 'Nom, niveau et année scolaire sont obligatoires.' });
      return;
    }
    // Section only applies to Humanités classes.
    const niveau = niveaux.find((n) => n.id === f.niveau_id);
    const isHumanites = niveau?.bulletin_template === 'humanites';

    setSaving(true);
    const payload = {
      nom: f.nom.trim(),
      niveau_id: f.niveau_id,
      titulaire_id: f.titulaire_id || null,
      section_id: isHumanites ? f.section_id || null : null,
      annee: f.annee.trim() || null,
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
        <button className="btn btn-outline btn-sm" onClick={openPreload}>Pré-charger les classes standard</button>
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
                <th>Section</th>
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
                  <td>{c.sections ? <span className="pill pill-green">{c.sections.nom}</span> : <span className="admin-sub" style={{ margin: 0 }}>—</span>}</td>
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
            {niveaux.find((n) => n.id === modal.form.niveau_id)?.bulletin_template === 'humanites' && (
              <div>
                <label className="lbl">Section (humanités)</label>
                {sections.length === 0 ? (
                  <div className="admin-sub" style={{ margin: 0 }}>Aucune section. Créez-en dans « Sections ».</div>
                ) : (
                  <select className="input" value={modal.form.section_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, section_id: e.target.value } })}>
                    <option value="">— Choisir —</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                )}
              </div>
            )}
            <div>
              <label className="lbl">Année (1 à 8)</label>
              <input className="input" placeholder="ex: 7 (utile au secondaire)" value={modal.form.annee} onChange={(e) => setModal({ ...modal, form: { ...modal.form, annee: e.target.value } })} />
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

      {preload && (
        <Modal
          title="Pré-charger les classes standard"
          onClose={() => setPreload(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPreload(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={doPreload} disabled={preloading}>{preloading ? 'Création…' : 'Créer les classes'}</button>
            </>
          }
        >
          <div style={{ marginBottom: 14 }}>
            <label className="lbl">Année scolaire</label>
            <input className="input" style={{ maxWidth: 200 }} value={preload.annee} onChange={(e) => setPreload({ ...preload, annee: e.target.value })} />
          </div>

          <label className="toggle" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={preload.primaire} onChange={(e) => setPreload({ ...preload, primaire: e.target.checked })} />
            <span className="track" />
            <span>Primaire — 1ère à 6ème année</span>
          </label>
          <br />
          <label className="toggle" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={preload.co} onChange={(e) => setPreload({ ...preload, co: e.target.checked })} />
            <span className="track" />
            <span>Cycle d'Orientation — 7ème, 8ème</span>
          </label>

          <div className="lbl">Humanités (1ère à 4ème) — choisir les sections :</div>
          {sections.length === 0 ? (
            <div className="admin-sub">Aucune section. Créez-en d'abord dans « Sections ».</div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--gris-bord)', borderRadius: 9, padding: 10 }}>
              {sections.map((s) => {
                const on = preload.sectionIds.includes(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setPreload({
                          ...preload,
                          sectionIds: e.target.checked ? [...preload.sectionIds, s.id] : preload.sectionIds.filter((x) => x !== s.id),
                        })
                      }
                    />
                    {s.nom}
                  </label>
                );
              })}
            </div>
          )}
          <p className="admin-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            Les classes déjà existantes (même nom + année) ne sont pas dupliquées. Vous pourrez ensuite renommer, ajouter des divisions (A, B…) et assigner les titulaires.
          </p>
        </Modal>
      )}
    </AdminLayout>
  );
}
