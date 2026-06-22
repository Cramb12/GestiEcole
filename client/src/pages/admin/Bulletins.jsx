// Admin bulletins — preview, approve (sign-off), print single or whole class.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { buildBulletin } from '../../lib/bulletin.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Bulletin from '../../components/Bulletin.jsx';
import Modal from '../../components/Modal.jsx';

export default function Bulletins() {
  const { ecole } = useEcole();
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [students, setStudents] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [approvals, setApprovals] = useState({});
  const [preview, setPreview] = useState([]);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState(null);
  const [apprModal, setApprModal] = useState(null);

  useEffect(() => {
    supabase.from('classes').select('id, nom, niveau_id, niveaux(nom)').order('nom').then(({ data }) => {
      setClasses(data || []);
      if (data && data.length) setClasseId(data[0].id);
    });
  }, []);

  const classe = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId]);
  const lastPeriode = useMemo(() => (periodes.length ? periodes[periodes.length - 1] : null), [periodes]);

  async function load() {
    if (!classe) return;
    const [els, per] = await Promise.all([
      supabase.from('eleves').select('id, nom, postnom, prenom').eq('classe_id', classeId).eq('actif', true).order('nom'),
      supabase.from('periodes').select('*').eq('niveau_id', classe.niveau_id).order('numero'),
    ]);
    setStudents(els.data || []);
    setPeriodes(per.data || []);
    setPreview([]);
    const lp = per.data && per.data.length ? per.data[per.data.length - 1] : null;
    if (lp) {
      const { data: appr } = await supabase.from('appreciation').select('eleve_id, signe_directeur').eq('classe_id', classeId).eq('periode_id', lp.id);
      const m = {};
      (appr || []).forEach((a) => (m[a.eleve_id] = a.signe_directeur));
      setApprovals(m);
    } else setApprovals({});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  async function previewOne(e) {
    setBuilding(true); setMsg(null);
    const d = await buildBulletin(e.id);
    setBuilding(false);
    if (!d) { setMsg({ type: 'error', text: 'Impossible de générer ce bulletin.' }); return; }
    setPreview([d]);
    setTimeout(() => document.getElementById('print-root')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function previewAll() {
    setBuilding(true); setMsg(null);
    const list = [];
    for (const e of students) {
      const d = await buildBulletin(e.id);
      if (d) list.push(d);
    }
    setBuilding(false);
    setPreview(list);
    setTimeout(() => document.getElementById('print-root')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function print() {
    if (preview.length === 0) { setMsg({ type: 'error', text: "Affichez d'abord un bulletin." }); return; }
    // Single-student print is blocked when the school requires payment and the
    // student isn't up to date. Whole-class prints proceed (debtors are stamped).
    if (preview.length === 1) {
      const p = preview[0].paiement;
      if (p?.exige && !p.enRegle) {
        setMsg({ type: 'error', text: `Élève non en règle de paiement (solde dû : ${Number(p.resteUSD).toFixed(2)} $). Impression bloquée.` });
        return;
      }
    }
    window.print();
  }

  async function setApproval(eleveId, value) {
    if (!lastPeriode) { setMsg({ type: 'error', text: 'Aucune période définie pour ce niveau.' }); return; }
    const { error } = await supabase.from('appreciation').upsert(
      { eleve_id: eleveId, classe_id: classeId, periode_id: lastPeriode.id, signe_directeur: value },
      { onConflict: 'eleve_id,periode_id' }
    );
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setApprovals((m) => ({ ...m, [eleveId]: value }));
    setPreview((list) => list.map((d) => (d.eleve.id === eleveId ? { ...d, approuve: value } : d)));
  }

  async function approveAll() {
    if (!lastPeriode) return;
    const rows = students.map((e) => ({ eleve_id: e.id, classe_id: classeId, periode_id: lastPeriode.id, signe_directeur: true }));
    const { error } = await supabase.from('appreciation').upsert(rows, { onConflict: 'eleve_id,periode_id' });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'success', text: 'Toute la classe est approuvée.' });
    load();
  }

  return (
    <AdminLayout title="Bulletins" subtitle="Aperçu, validation (signature) puis impression PDF (un élève ou toute la classe)." ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <div>
          <label className="lbl">Classe</label>
          <select className="input" style={{ minWidth: 220 }} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline btn-sm" onClick={previewAll} disabled={building || !students.length}>Aperçu de toute la classe</button>
        <button className="btn btn-secondary btn-sm" onClick={approveAll} disabled={!students.length}>Approuver toute la classe</button>
        <button className="btn btn-primary btn-sm" onClick={print} disabled={!preview.length}>Imprimer (PDF)</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}
      {periodes.length === 0 && <div className="locked-banner">Ce niveau n'a pas de périodes : créez-les dans « Périodes » avant de générer les bulletins.</div>}
      {building && <div className="empty-state">Génération en cours…</div>}

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Élève</th><th>Validation</th><th></th></tr></thead>
          <tbody>
            {students.map((e) => (
              <tr key={e.id}>
                <td><strong>{`${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim()}</strong></td>
                <td>{approvals[e.id] ? <span className="pill pill-green">Approuvé</span> : <span className="pill pill-gray">Provisoire</span>}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => previewOne(e)}>Aperçu</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setApprModal(e)}>Appréciation</button>
                    {approvals[e.id]
                      ? <button className="btn btn-danger btn-sm" onClick={() => setApproval(e.id, false)}>Retirer</button>
                      : <button className="btn btn-primary btn-sm" onClick={() => setApproval(e.id, true)}>Approuver</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print/preview area */}
      <div id="print-root">
        {preview.length > 0 && (
          <div className="bulletin-actions">
            <button className="btn btn-primary btn-sm" onClick={print}>Imprimer / Enregistrer en PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreview([])}>Fermer l'aperçu</button>
            <span className="admin-sub" style={{ margin: 0 }}>{preview.length} bulletin(s) — Ctrl+P puis « Enregistrer en PDF »</span>
          </div>
        )}
        {preview.map((d) => <Bulletin key={d.eleve.id} data={d} />)}
      </div>

      {apprModal && (
        <AppreciationModal
          eleve={apprModal}
          classeId={classeId}
          periode={lastPeriode}
          system={classe?.niveaux ? undefined : undefined}
          onClose={() => setApprModal(null)}
          onSaved={() => { setApprModal(null); setMsg({ type: 'success', text: 'Appréciation enregistrée.' }); }}
        />
      )}
    </AdminLayout>
  );
}

function AppreciationModal({ eleve, classeId, periode, onClose, onSaved }) {
  const [form, setForm] = useState({ application: '', conduite: '', deliberation: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!periode) return;
    supabase.from('appreciation').select('*').eq('eleve_id', eleve.id).eq('periode_id', periode.id).maybeSingle()
      .then(({ data }) => { if (data) setForm({ application: data.application || '', conduite: data.conduite || '', deliberation: data.deliberation || '' }); });
  }, [eleve.id, periode]);

  async function save() {
    if (!periode) { setErr('Aucune période de fin définie.'); return; }
    setSaving(true);
    const { error } = await supabase.from('appreciation').upsert(
      { eleve_id: eleve.id, classe_id: classeId, periode_id: periode.id, application: form.application || null, conduite: form.conduite || null, deliberation: form.deliberation || null },
      { onConflict: 'eleve_id,periode_id' }
    );
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <Modal
      title={`Appréciation — ${eleve.nom} ${eleve.postnom || ''}`}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </>}
    >
      {err && <div className="alert-error">{err}</div>}
      <div className="form-grid">
        <div>
          <label className="lbl">Application</label>
          <input className="input" placeholder="ex: Bien" value={form.application} onChange={(e) => setForm({ ...form, application: e.target.value })} />
        </div>
        <div>
          <label className="lbl">Conduite</label>
          <input className="input" placeholder="ex: Bonne" value={form.conduite} onChange={(e) => setForm({ ...form, conduite: e.target.value })} />
        </div>
        <div>
          <label className="lbl">Décision (secondaire)</label>
          <select className="input" value={form.deliberation} onChange={(e) => setForm({ ...form, deliberation: e.target.value })}>
            <option value="">—</option>
            <option value="passe">Passe</option>
            <option value="double">Double</option>
            <option value="repechage">Repêchage</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
