// Platform-owner screen — list every registered school and manage its
// subscription (activate after payment, extend a trial, suspend).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import Layout from '../components/Layout.jsx';

const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

// Human label + pill class from a school's subscription state.
function state(ec) {
  if (ec.statut === 'actif') return { label: 'Actif', cls: 'pill-green' };
  if (ec.statut === 'suspendu') return { label: 'Suspendu', cls: 'pill-gray' };
  if (ec.statut === 'essai') {
    if (ec.essai_fin && ec.essai_fin >= today()) {
      const d = Math.max(1, Math.ceil((new Date(ec.essai_fin) - new Date(today())) / 86400000));
      return { label: `Essai (${d} j)`, cls: 'pill-yellow' };
    }
    return { label: 'Essai expiré', cls: 'pill-red' };
  }
  return { label: 'Expiré', cls: 'pill-red' };
}

export default function Vendeur() {
  const [ecoles, setEcoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ecole').select('*').order('created_at', { ascending: false });
    setEcoles(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function patch(ec, fields, label) {
    setBusy(ec.id); setMsg(null);
    const { error } = await supabase.from('ecole').update(fields).eq('id', ec.id);
    setBusy(null);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'success', text: `${ec.nom_ecole} — ${label}.` });
    load();
  }

  const activer = (ec) => patch(ec, { statut: 'actif', abonnement_fin: addDays(365) }, 'activée pour 1 an');
  const prolonger = (ec) => patch(ec, { statut: 'essai', essai_fin: addDays(30) }, "essai prolongé de 30 jours");
  const suspendre = (ec) => patch(ec, { statut: 'suspendu' }, 'suspendue');

  const counts = ecoles.reduce((a, ec) => { a[ec.statut] = (a[ec.statut] || 0) + 1; return a; }, {});

  return (
    <Layout ecoleNom="GestiEcole — Plateforme">
      <div className="welcome">
        <h1>Écoles inscrites</h1>
        <p>Gérez les abonnements : activez une école après paiement, prolongez un essai ou suspendez.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="value">{ecoles.length}</div><div>Écoles au total</div></div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--vert, #1c8a4d)' }}><div className="value">{counts.actif || 0}</div><div>Actives (payantes)</div></div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--jaune)' }}><div className="value">{counts.essai || 0}</div><div>En essai</div></div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--rouge)' }}><div className="value">{counts.suspendu || 0}</div><div>Suspendues</div></div>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : ecoles.length === 0 ? (
        <div className="empty-state">Aucune école inscrite pour l'instant.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>École</th><th>Ville</th><th>Année</th><th>Statut</th><th>Essai / Abonnement</th><th>Inscrite le</th><th></th></tr>
            </thead>
            <tbody>
              {ecoles.map((ec) => {
                const s = state(ec);
                return (
                  <tr key={ec.id}>
                    <td><strong>{ec.nom_ecole}</strong></td>
                    <td>{ec.ville || '—'}</td>
                    <td>{ec.annee_scolaire || '—'}</td>
                    <td><span className={`pill ${s.cls}`}>{s.label}</span></td>
                    <td style={{ fontSize: 13 }}>
                      {ec.statut === 'actif'
                        ? <>Abonné jusqu'au <strong>{ec.abonnement_fin || '—'}</strong></>
                        : <>Essai jusqu'au <strong>{ec.essai_fin || '—'}</strong></>}
                    </td>
                    <td style={{ fontSize: 13 }}>{(ec.created_at || '').slice(0, 10)}</td>
                    <td>
                      <div className="row-actions">
                        {ec.statut !== 'actif' && (
                          <button className="btn btn-primary btn-sm" disabled={busy === ec.id} onClick={() => activer(ec)}>Activer (1 an)</button>
                        )}
                        <button className="btn btn-outline btn-sm" disabled={busy === ec.id} onClick={() => prolonger(ec)}>Prolonger l'essai +30 j</button>
                        {ec.statut !== 'suspendu' && (
                          <button className="btn btn-danger btn-sm" disabled={busy === ec.id} onClick={() => suspendre(ec)}>Suspendre</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
