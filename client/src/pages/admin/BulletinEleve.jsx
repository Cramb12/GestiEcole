// Single-student bulletin view (opened from the student profile).
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { buildBulletin } from '../../lib/bulletin.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import Bulletin from '../../components/Bulletin.jsx';

export default function BulletinEleve() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ecole } = useEcole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    const d = await buildBulletin(id);
    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function doPrint() {
    const p = data?.paiement;
    if (p?.exige && !p.enRegle) {
      setMsg({ type: 'error', text: `Élève non en règle de paiement (solde dû : ${Number(p.resteUSD).toFixed(2)} $). Impression du bulletin bloquée.` });
      return;
    }
    window.print();
  }

  async function setApproval(value) {
    const lp = data?.periodes?.[data.periodes.length - 1];
    if (!lp) { setMsg({ type: 'error', text: 'Aucune période définie pour ce niveau.' }); return; }
    const { error } = await supabase.from('appreciation').upsert(
      { eleve_id: id, classe_id: data.classe.id, periode_id: lp.id, signe_directeur: value },
      { onConflict: 'eleve_id,periode_id' }
    );
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setData((d) => ({ ...d, approuve: value }));
  }

  return (
    <AdminLayout title="Bulletin de l'élève" ecoleNom={ecole?.nom_ecole}>
      <div className="toolbar">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/eleves/${id}`)}>← Profil</button>
        <div className="spacer" />
        {data && (data.approuve
          ? <button className="btn btn-danger btn-sm" onClick={() => setApproval(false)}>Retirer la validation</button>
          : <button className="btn btn-outline btn-sm" onClick={() => setApproval(true)}>Approuver</button>)}
        <button className="btn btn-primary btn-sm" onClick={doPrint} disabled={!data}>Imprimer / PDF</button>
      </div>

      {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

      {loading ? (
        <div className="empty-state">Génération du bulletin…</div>
      ) : !data ? (
        <div className="alert-error">Impossible de générer ce bulletin (élève ou classe introuvable).</div>
      ) : (
        <div id="print-root"><Bulletin data={data} /></div>
      )}
    </AdminLayout>
  );
}
