// École settings — single record. Form + logo upload to Supabase Storage.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import AdminLayout from '../../components/AdminLayout.jsx';

const EMPTY = {
  nom_ecole: '',
  province: '',
  ville: '',
  commune: '',
  code_ecole: '',
  annee_scolaire: '',
  logo_url: '',
};

export default function Configuration() {
  const [form, setForm] = useState(EMPTY);
  const [ecoleId, setEcoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }

  useEffect(() => {
    supabase
      .from('ecole')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEcoleId(data.id);
          setForm({
            nom_ecole: data.nom_ecole || '',
            province: data.province || '',
            ville: data.ville || '',
            commune: data.commune || '',
            code_ecole: data.code_ecole || '',
            annee_scolaire: data.annee_scolaire || '',
            logo_url: data.logo_url || '',
          });
        }
        setLoading(false);
      });
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('ecole')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('ecole').getPublicUrl(path);
      update('logo_url', data.publicUrl);
      setMsg({ type: 'success', text: 'Logo téléversé. N’oubliez pas d’enregistrer.' });
    } catch (err) {
      setMsg({
        type: 'error',
        text:
          "Échec du téléversement. Avez-vous exécuté database/storage.sql dans Supabase ? (" +
          (err.message || 'erreur') +
          ')',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setMsg(null);

    if (!form.nom_ecole.trim()) {
      setMsg({ type: 'error', text: "Le nom de l'école est obligatoire." });
      return;
    }
    if (!form.annee_scolaire.trim()) {
      setMsg({ type: 'error', text: "L'année scolaire est obligatoire (ex: 2025-2026)." });
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      let res;
      if (ecoleId) {
        res = await supabase.from('ecole').update(payload).eq('id', ecoleId).select('id').single();
      } else {
        res = await supabase.from('ecole').insert(payload).select('id').single();
      }
      if (res.error) throw res.error;
      setEcoleId(res.data.id);
      setMsg({ type: 'success', text: 'Informations enregistrées avec succès.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || "Échec de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Configuration de l'école"
      subtitle="Ces informations apparaîtront automatiquement sur tous les bulletins."
      ecoleNom={form.nom_ecole}
    >
      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : (
        <form className="panel" onSubmit={handleSave}>
          {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
            <img
              className="logo-preview"
              src={form.logo_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect width="90" height="90" fill="%23f4f6f9"/><text x="45" y="50" font-size="34" text-anchor="middle">🏫</text></svg>'}
              alt="Logo de l'école"
            />
            <div>
              <label className="lbl">Logo de l'école</label>
              <input type="file" accept="image/*" onChange={handleLogo} disabled={uploading} />
              {uploading && <div className="admin-sub" style={{ margin: '6px 0 0' }}>Téléversement…</div>}
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label className="lbl">Nom de l'école <span className="req">*</span></label>
              <input className="input" value={form.nom_ecole} onChange={(e) => update('nom_ecole', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Année scolaire <span className="req">*</span></label>
              <input className="input" placeholder="2025-2026" value={form.annee_scolaire} onChange={(e) => update('annee_scolaire', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Province</label>
              <input className="input" value={form.province} onChange={(e) => update('province', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Ville</label>
              <input className="input" value={form.ville} onChange={(e) => update('ville', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Commune / Territoire</label>
              <input className="input" value={form.commune} onChange={(e) => update('commune', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Code de l'école</label>
              <input className="input" value={form.code_ecole} onChange={(e) => update('code_ecole', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
