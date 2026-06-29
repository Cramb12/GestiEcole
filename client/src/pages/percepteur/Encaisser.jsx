// Percepteur (and director) cash-in screen: pick a student, see balances per
// fee/tranche (in USD), record a payment, print a numbered receipt.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { feeApplies, feeSituation } from '../../lib/frais.js';
import PercepteurLayout from '../../components/PercepteurLayout.jsx';
import Modal from '../../components/Modal.jsx';
import Recu from '../../components/Recu.jsx';
import Combobox from '../../components/Combobox.jsx';
import { fetchAll } from '../../lib/db.js';

const MODES = [['especes', 'Espèces'], ['airtel', 'Airtel Money'], ['orange', 'Orange Money'], ['mpesa', 'M-Pesa'], ['banque', 'Banque'], ['autre', 'Autre']];
const usd = (n) => `${Number(n || 0).toFixed(2)} $`;

export default function Encaisser() {
  const { ecole } = useEcole();
  const { user } = useAuth();
  const taux = ecole?.taux_fc_usd;

  const [frais, setFrais] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [reductions, setReductions] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recu, setRecu] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('frais').select('*').eq('actif', true).order('libelle'),
      fetchAll(() => supabase.from('eleves').select('id, nom, postnom, prenom, classe_id, classes(niveau_id)').eq('actif', true).order('nom').order('id')),
    ]).then(([f, e]) => { setFrais(f.data || []); setEleves(e || []); });
  }, []);

  const eleve = useMemo(() => eleves.find((e) => e.id === eleveId), [eleves, eleveId]);
  const niveauId = eleve?.classes?.niveau_id || null;
  const fraisEleve = useMemo(() => frais.filter((f) => feeApplies(f, niveauId)), [frais, niveauId]);

  async function loadStudent(id) {
    if (!id) { setReductions([]); setPaiements([]); return; }
    const [r, p] = await Promise.all([
      supabase.from('frais_reductions').select('*').eq('eleve_id', id),
      supabase.from('paiements').select('*').eq('eleve_id', id),
    ]);
    setReductions(r.data || []);
    setPaiements(p.data || []);
  }
  useEffect(() => { loadStudent(eleveId); }, [eleveId]);

  const situation = useMemo(
    () => feeSituation(fraisEleve, reductions, paiements, taux),
    [fraisEleve, reductions, paiements, taux]
  );

  function openPay(ligne, tranche) {
    setMsg(null);
    const devise = ligne.frais.devise;
    const prefill = devise === 'USD' ? tranche.resteUSD : Math.round(tranche.resteUSD * (Number(taux) || 0));
    setModal({
      frais: ligne.frais, tranche,
      form: { montant: prefill ? String(prefill) : '', devise, mode: 'especes' },
    });
  }

  async function savePay() {
    const f = modal.form;
    if (f.montant === '' || Number(f.montant) <= 0) { setMsg({ type: 'error', text: 'Montant invalide.' }); return; }
    if (f.devise === 'FC' && !taux) { setMsg({ type: 'error', text: "Définissez d'abord le taux FC/USD (page Frais)." }); return; }
    setSaving(true);
    const payload = {
      eleve_id: eleveId, frais_id: modal.frais.id,
      tranche: modal.tranche.no, tranche_label: modal.tranche.label,
      montant: Number(f.montant), devise: f.devise,
      taux_fc_usd: f.devise === 'FC' ? Number(taux) : null, mode: f.mode,
    };
    const { data, error } = await supabase.from('paiements').insert(payload).select('*').single();
    setSaving(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setModal(null);
    setRecu({ ecole, eleve, paiement: data, frais: modal.frais, percepteur: `${user?.nom || ''} ${user?.postnom || ''}`.trim() });
    setMsg({ type: 'success', text: `Paiement enregistré — reçu ${data.recu_numero}.` });
    loadStudent(eleveId);
  }

  const eleveNom = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const eleveOptions = useMemo(() => eleves.map((e) => ({ id: e.id, label: eleveNom(e) })), [eleves]);

  return (
    <PercepteurLayout title="Encaisser" subtitle="Choisissez un élève, consultez les soldes et enregistrez un paiement.">
      <div className="no-print">
        {!taux && (
          <div className="alert-error">Aucun taux de change défini — les paiements en FC seront refusés. Réglez-le dans « Frais ».</div>
        )}
        {msg && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}

        <div className="card-box">
          <div style={{ maxWidth: 460 }}>
            <Combobox
              label="Élève"
              placeholder="Tapez le nom de l'élève…"
              items={eleveOptions}
              value={eleveId}
              onChange={setEleveId}
            />
          </div>
        </div>

        {eleveId && (
          fraisEleve.length === 0 ? (
            <div className="empty-state">Aucun frais défini pour cette classe. Configurez le barème dans « Frais ».</div>
          ) : (
            <>
              <div className="finance-summary">
                <div><span>Total dû</span><strong>{usd(situation.totalDueUSD)}</strong></div>
                <div><span>Payé</span><strong className="ok">{usd(situation.totalPaidUSD)}</strong></div>
                <div><span>Reste</span><strong className={situation.totalResteUSD > 0 ? 'due' : 'ok'}>{usd(situation.totalResteUSD)}</strong></div>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Frais</th><th>Tranche</th><th>Dû</th><th>Payé</th><th>Reste</th><th></th></tr></thead>
                  <tbody>
                    {situation.lignes.map((ligne) => ligne.tranches.map((t, i) => (
                      <tr key={ligne.frais.id + '-' + t.no}>
                        <td>{i === 0 ? <strong>{ligne.frais.libelle}{ligne.red > 0 ? ` (−${ligne.red}%)` : ''}</strong> : ''}</td>
                        <td>{t.label}</td>
                        <td>{usd(t.dueUSD)}</td>
                        <td>{usd(t.paidUSD)}</td>
                        <td className={t.resteUSD > 0 ? 'due' : 'ok'}>{usd(t.resteUSD)}</td>
                        <td>
                          {t.resteUSD > 0
                            ? <button className="btn btn-primary btn-sm" onClick={() => openPay(ligne, t)}>Encaisser</button>
                            : <span className="pill pill-green">Soldé</span>}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      {recu && (
        <div id="print-root">
          <div className="bulletin-actions">
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Imprimer le reçu</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setRecu(null)}>Fermer</button>
          </div>
          <Recu data={recu} />
        </div>
      )}

      {modal && (
        <Modal
          title={`Encaisser — ${modal.frais.libelle} (${modal.tranche.label})`}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={savePay} disabled={saving}>{saving ? 'Enregistrement…' : 'Valider le paiement'}</button>
          </>}
        >
          {msg && msg.type === 'error' && <div className="alert-error">{msg.text}</div>}
          <div className="form-grid">
            <div>
              <label className="lbl">Montant</label>
              <input className="input" type="number" value={modal.form.montant} onChange={(e) => setModal({ ...modal, form: { ...modal.form, montant: e.target.value } })} />
            </div>
            <div>
              <label className="lbl">Devise</label>
              <select className="input" value={modal.form.devise} onChange={(e) => setModal({ ...modal, form: { ...modal.form, devise: e.target.value } })}>
                <option value="USD">USD</option>
                <option value="FC">FC{taux ? ` (1 USD = ${taux} FC)` : ''}</option>
              </select>
            </div>
            <div>
              <label className="lbl">Mode de paiement</label>
              <select className="input" value={modal.form.mode} onChange={(e) => setModal({ ...modal, form: { ...modal.form, mode: e.target.value } })}>
                {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <p className="admin-sub" style={{ marginTop: 10 }}>Reste sur cette tranche : <strong>{usd(modal.tranche.resteUSD)}</strong></p>
        </Modal>
      )}
    </PercepteurLayout>
  );
}
