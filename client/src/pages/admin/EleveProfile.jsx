// Student profile — personal info, attendance %, marks per period, promotion.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { isProvisional } from '../../lib/perm.js';
import { fetchAll } from '../../lib/db.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Modal from '../../components/Modal.jsx';

export default function EleveProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ecole } = useEcole();

  const [eleve, setEleve] = useState(null);
  const [presences, setPresences] = useState([]);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null);
  const [promo, setPromo] = useState(null);

  async function load() {
    setLoading(true);
    const { data: el, error: e1 } = await supabase
      .from('eleves')
      .select('*, classes(nom, niveau_id, niveaux(nom), sections(nom))')
      .eq('id', id)
      .maybeSingle();
    if (e1 || !el) {
      setError("Élève introuvable.");
      setLoading(false);
      return;
    }
    setEleve(el);

    const [pr, nt, hi, cl] = await Promise.all([
      fetchAll(() => supabase.from('presences').select('statut').eq('eleve_id', id).order('id')),
      supabase.from('notes').select('points_obtenus, max_periode, periodes(nom)').eq('eleve_id', id),
      supabase.from('promotions_history').select('*, classes(nom)').eq('eleve_id', id).order('created_at', { ascending: false }),
      supabase.from('classes').select('id, nom, niveaux(nom)').order('nom'),
    ]);
    setPresences(pr);
    setNotes(nt.data || []);
    setHistory(hi.data || []);
    setClasses(cl.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Attendance %.
  const total = presences.length;
  const present = presences.filter((p) => p.statut === 'present').length;
  const absents = presences.filter((p) => p.statut === 'absent').length;
  const retards = presences.filter((p) => p.statut === 'retard').length;
  const tauxPresence = total ? Math.round((present / total) * 100) : null;

  const fullName = eleve ? `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim() : '';

  return (
    <AdminLayout title="Profil de l'élève" ecoleNom={ecole?.nom_ecole}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/eleves')} style={{ marginBottom: 16 }}>
        ← Retour à la liste
      </button>

      {loading ? (
        <div className="empty-state">Chargement…</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
        <>
          {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

          {/* Identity */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 22, marginBottom: 4 }}>{fullName}</h2>
                <div className="admin-sub" style={{ margin: 0 }}>
                  N° PERM : <strong>{eleve.numero_perm}</strong>
                  {isProvisional(eleve.numero_perm) && <span className="pill pill-gray" style={{ marginLeft: 8 }}>provisoire</span>}
                  {!eleve.actif && <span className="pill pill-red" style={{ marginLeft: 8 }}>Inactif</span>}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setMsg(null); setPromo({ decision: '', classe_id: '' }); }}>
                Décision de fin d'année
              </button>
            </div>

            <div className="form-grid" style={{ marginTop: 18 }}>
              <Info label="Sexe" value={eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : '—'} />
              <Info label="Date de naissance" value={eleve.date_naissance || '—'} />
              <Info label="Lieu de naissance" value={eleve.lieu_naissance || '—'} />
              <Info label="Classe" value={eleve.classes?.nom || '—'} />
              <Info label="Niveau" value={eleve.classes?.niveaux?.nom || '—'} />
              <Info label="Section" value={eleve.classes?.sections?.nom || '—'} />
              <Info label="Année scolaire" value={eleve.annee_scolaire} />
              <Info label="École de provenance" value={eleve.ecole_provenance || '—'} />
            </div>
          </div>

          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="value">{tauxPresence === null ? '—' : tauxPresence + '%'}</div>
              <div className="label">Taux de présence</div>
            </div>
            <div className="stat-card j">
              <div className="value">{absents}</div>
              <div className="label">Absences</div>
            </div>
            <div className="stat-card r">
              <div className="value">{retards}</div>
              <div className="label">Retards</div>
            </div>
          </div>

          {/* Marks summary */}
          <div className="panel">
            <h3>Résumé des notes</h3>
            {notes.length === 0 ? (
              <div className="admin-sub" style={{ margin: 0 }}>Aucune note enregistrée pour le moment (saisie des notes en Phase 5).</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Période</th><th>Points obtenus</th><th>Maximum</th><th>%</th></tr></thead>
                  <tbody>
                    {Object.values(
                      notes.reduce((acc, n) => {
                        const k = n.periodes?.nom || '—';
                        acc[k] = acc[k] || { nom: k, obt: 0, max: 0 };
                        acc[k].obt += Number(n.points_obtenus) || 0;
                        acc[k].max += Number(n.max_periode) || 0;
                        return acc;
                      }, {})
                    ).map((r, i) => (
                      <tr key={i}>
                        <td>{r.nom}</td>
                        <td>{r.obt}</td>
                        <td>{r.max}</td>
                        <td>{r.max > 0 ? ((r.obt / r.max) * 100).toFixed(1) + ' %' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bulletin link */}
          <div className="panel">
            <h3>Bulletin</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/admin/eleves/${id}/bulletin`)}>Voir le bulletin</button>
          </div>

          {/* Promotion history */}
          {history.length > 0 && (
            <div className="panel">
              <h3>Historique des décisions</h3>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Année</th><th>Décision</th><th>Classe</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{h.annee_scolaire}</td>
                        <td><span className="pill pill-gray">{h.decision}</span></td>
                        <td>{h.classes?.nom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {promo && (
        <PromotionModal
          eleve={eleve}
          classes={classes}
          promo={promo}
          setPromo={setPromo}
          annee={eleve?.annee_scolaire}
          onDone={(text) => {
            setPromo(null);
            setMsg({ type: 'success', text });
            load();
          }}
          onError={(text) => setMsg({ type: 'error', text })}
        />
      )}
    </AdminLayout>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <div>{value}</div>
    </div>
  );
}

// --- Promotion / year-end decision modal ------------------------------
function PromotionModal({ eleve, classes, promo, setPromo, annee, onDone, onError }) {
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!promo.decision) {
      onError('Veuillez choisir une décision.');
      return;
    }
    if (promo.decision === 'promu' && !promo.classe_id) {
      onError('Veuillez choisir la classe de destination.');
      return;
    }
    setBusy(true);

    // 1. Record the decision in history (for the current year).
    const histRow = {
      eleve_id: eleve.id,
      annee_scolaire: annee,
      classe_id: eleve.classe_id,
      decision: promo.decision,
    };
    const { error: hErr } = await supabase.from('promotions_history').insert(histRow);
    if (hErr) {
      setBusy(false);
      onError(hErr.message);
      return;
    }

    // 2. Apply the consequence on the student record.
    const updates = {};
    if (promo.decision === 'promu') updates.classe_id = promo.classe_id;
    if (promo.decision === 'exclu' || promo.decision === 'termine') updates.actif = false;
    if (Object.keys(updates).length) {
      const { error: uErr } = await supabase.from('eleves').update(updates).eq('id', eleve.id);
      if (uErr) {
        setBusy(false);
        onError(uErr.message);
        return;
      }
    }

    setBusy(false);
    onDone('Décision enregistrée.');
  }

  return (
    <Modal
      title="Décision de fin d'année"
      onClose={() => setPromo(null)}
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => setPromo(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={apply} disabled={busy}>{busy ? 'Enregistrement…' : 'Valider la décision'}</button>
        </>
      }
    >
      <div className="form-grid">
        <div>
          <label className="lbl">Décision <span className="req">*</span></label>
          <select className="input" value={promo.decision} onChange={(e) => setPromo({ ...promo, decision: e.target.value })}>
            <option value="">— Choisir —</option>
            <option value="promu">Promu (classe supérieure)</option>
            <option value="redoublant">Redoublant (même classe)</option>
            <option value="termine">A terminé le cycle</option>
            <option value="exclu">Exclu</option>
          </select>
        </div>
        {promo.decision === 'promu' && (
          <div>
            <label className="lbl">Nouvelle classe <span className="req">*</span></label>
            <select className="input" value={promo.classe_id} onChange={(e) => setPromo({ ...promo, classe_id: e.target.value })}>
              <option value="">— Choisir —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="admin-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        La décision est conservée dans l'historique de l'élève. « Promu » déplace l'élève vers la nouvelle classe ;
        « Exclu » et « A terminé » rendent l'élève inactif.
      </p>
    </Modal>
  );
}
