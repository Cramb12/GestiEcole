// Finance reports (percepteur / director): overview + collection rate, arrears,
// cash report by payment mode, and a printable per-student statement.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEcole } from '../../lib/useEcole.js';
import { downloadCSV } from '../../lib/csv.js';
import { feeApplies, feeSituation, reductionPct, toUSD } from '../../lib/frais.js';
import PercepteurLayout from '../../components/PercepteurLayout.jsx';
import Releve from '../../components/Releve.jsx';

const usd = (n) => `${Number(n || 0).toFixed(2)} $`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const MODES = [['especes', 'Espèces'], ['airtel', 'Airtel Money'], ['orange', 'Orange Money'], ['mpesa', 'M-Pesa'], ['banque', 'Banque'], ['autre', 'Autre']];
const eleveNom = (e) => `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();

export default function Rapports() {
  const { ecole } = useEcole();
  const taux = ecole?.taux_fc_usd;
  const [tab, setTab] = useState('apercu');
  const [eleves, setEleves] = useState([]);
  const [frais, setFrais] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [reductions, setReductions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Caisse date range + Relevé student.
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [releveId, setReleveId] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('eleves').select('id, nom, postnom, prenom, classe_id, classes(nom, niveau_id)').eq('actif', true).order('nom'),
      supabase.from('frais').select('*').eq('actif', true),
      supabase.from('paiements').select('*, frais(libelle)').eq('annule', false).order('date_paiement', { ascending: false }),
      supabase.from('frais_reductions').select('*'),
    ]).then(([e, f, p, r]) => {
      setEleves(e.data || []); setFrais(f.data || []); setPaiements(p.data || []); setReductions(r.data || []);
      setLoading(false);
    });
  }, []);

  const redByEleve = useMemo(() => group(reductions, 'eleve_id'), [reductions]);
  const payByEleve = useMemo(() => group(paiements, 'eleve_id'), [paiements]);

  // Per-student due / paid / balance (USD).
  const perStudent = useMemo(() => eleves.map((e) => {
    const niveauId = e.classes?.niveau_id || null;
    const applicable = frais.filter((f) => feeApplies(f, niveauId));
    const s = feeSituation(applicable, redByEleve[e.id], payByEleve[e.id], taux);
    return { e, classe: e.classes?.nom || '—', due: s.totalDueUSD, paid: s.totalPaidUSD, reste: s.totalResteUSD };
  }), [eleves, frais, redByEleve, payByEleve, taux]);

  const global = useMemo(() => perStudent.reduce((a, r) => ({ due: a.due + r.due, paid: a.paid + r.paid, reste: a.reste + r.reste }), { due: 0, paid: 0, reste: 0 }), [perStudent]);

  const byClass = useMemo(() => {
    const m = {};
    perStudent.forEach((r) => { (m[r.classe] = m[r.classe] || { classe: r.classe, n: 0, due: 0, paid: 0 }); m[r.classe].n++; m[r.classe].due += r.due; m[r.classe].paid += r.paid; });
    return Object.values(m).sort((a, b) => a.classe.localeCompare(b.classe));
  }, [perStudent]);

  const byFee = useMemo(() => frais.map((f) => {
    let due = 0, paid = 0;
    eleves.forEach((e) => {
      if (!feeApplies(f, e.classes?.niveau_id)) return;
      const red = reductionPct(redByEleve[e.id], f.id);
      due += toUSD(f.montant, f.devise, taux) * (1 - red / 100);
      paid += (payByEleve[e.id] || []).filter((p) => p.frais_id === f.id).reduce((s, p) => s + (Number(p.montant_usd) || 0), 0);
    });
    return { libelle: f.libelle, due, paid };
  }), [frais, eleves, redByEleve, payByEleve, taux]);

  // Caisse : payments within range, grouped by mode.
  const caisse = useMemo(() => {
    const inRange = paiements.filter((p) => (!du || p.date_paiement >= du) && (!au || p.date_paiement <= au));
    const byMode = {}; let total = 0;
    inRange.forEach((p) => { const v = Number(p.montant_usd) || 0; byMode[p.mode] = (byMode[p.mode] || 0) + v; total += v; });
    return { list: inRange, byMode, total };
  }, [paiements, du, au]);

  const eleveById = useMemo(() => Object.fromEntries(eleves.map((e) => [e.id, e])), [eleves]);
  const releve = useMemo(() => {
    if (!releveId) return null;
    const e = eleveById[releveId]; if (!e) return null;
    const r = perStudent.find((x) => x.e.id === releveId);
    const pays = (payByEleve[releveId] || []).slice().sort((a, b) => (a.date_paiement || '').localeCompare(b.date_paiement || ''));
    return { ecole, eleve: e, classe: e.classes?.nom, paiements: pays, due: r?.due || 0, paid: r?.paid || 0, reste: r?.reste || 0 };
  }, [releveId, eleveById, perStudent, payByEleve, ecole]);

  const arrears = perStudent.filter((r) => r.reste > 0.01).sort((a, b) => b.reste - a.reste);

  function exportArrears() {
    const h = 'Élève,Classe,Dû (USD),Payé (USD),Reste (USD)';
    const lines = arrears.map((r) => `"${eleveNom(r.e)}","${r.classe}",${r.due.toFixed(2)},${r.paid.toFixed(2)},${r.reste.toFixed(2)}`);
    downloadCSV('arrieres.csv', h + '\n' + lines.join('\n') + '\n');
  }
  function exportCaisse() {
    const h = 'Date,Élève,Frais,Montant,Devise,USD,Mode,Reçu';
    const lines = caisse.list.map((p) => `${p.date_paiement},"${eleveNom(eleveById[p.eleve_id] || {})}","${p.frais?.libelle || ''}",${p.montant},${p.devise},${p.montant_usd},${p.mode},${p.recu_numero}`);
    downloadCSV('caisse.csv', h + '\n' + lines.join('\n') + '\n');
  }

  if (loading) return <PercepteurLayout title="Rapports"><div className="empty-state">Chargement…</div></PercepteurLayout>;

  return (
    <PercepteurLayout title="Rapports" subtitle="Encaissements, arriérés et taux de recouvrement.">
      <div className="no-print">
        <div className="tabs">
          {[['apercu', "Vue d'ensemble"], ['arrieres', 'Arriérés'], ['caisse', 'Caisse'], ['releve', 'Relevé élève']].map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'apercu' && (
          <>
            <div className="finance-summary">
              <div><span>Montant prospecté</span><strong>{usd(global.due)}</strong></div>
              <div><span>Encaissé</span><strong className="ok">{usd(global.paid)}</strong></div>
              <div><span>Reste à recouvrer</span><strong className="due">{usd(global.reste)}</strong></div>
              <div><span>Taux d'encaissement</span><strong>{pct(global.paid, global.due)} %</strong></div>
            </div>

            <h3 className="card-title">Par classe</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Classe</th><th>Effectif</th><th>Prospecté</th><th>Encaissé</th><th>%</th></tr></thead>
                <tbody>
                  {byClass.map((c) => (
                    <tr key={c.classe}><td><strong>{c.classe}</strong></td><td>{c.n}</td><td>{usd(c.due)}</td><td>{usd(c.paid)}</td><td>{bar(pct(c.paid, c.due))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="card-title" style={{ marginTop: 22 }}>Par frais</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Frais</th><th>Prospecté</th><th>Encaissé</th><th>%</th></tr></thead>
                <tbody>
                  {byFee.map((f) => (
                    <tr key={f.libelle}><td><strong>{f.libelle}</strong></td><td>{usd(f.due)}</td><td>{usd(f.paid)}</td><td>{bar(pct(f.paid, f.due))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'arrieres' && (
          <>
            <div className="toolbar">
              <span className="admin-sub" style={{ margin: 0 }}>{arrears.length} élève(s) en retard — total {usd(arrears.reduce((s, r) => s + r.reste, 0))}</span>
              <div className="spacer" />
              <button className="btn btn-outline btn-sm" onClick={exportArrears} disabled={!arrears.length}>Exporter CSV</button>
            </div>
            {arrears.length === 0 ? <div className="empty-state">Aucun arriéré. Tout est en règle.</div> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Élève</th><th>Classe</th><th>Dû</th><th>Payé</th><th>Reste</th></tr></thead>
                  <tbody>
                    {arrears.map((r) => (
                      <tr key={r.e.id}><td><strong>{eleveNom(r.e)}</strong></td><td>{r.classe}</td><td>{usd(r.due)}</td><td>{usd(r.paid)}</td><td className="due">{usd(r.reste)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'caisse' && (
          <>
            <div className="card-box">
              <div className="form-grid">
                <div><label className="lbl">Du</label><input className="input" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></div>
                <div><label className="lbl">Au</label><input className="input" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></div>
              </div>
              <div className="finance-summary" style={{ marginTop: 14 }}>
                <div><span>Total encaissé</span><strong className="ok">{usd(caisse.total)}</strong></div>
                {MODES.filter(([m]) => caisse.byMode[m]).map(([m, l]) => (
                  <div key={m}><span>{l}</span><strong>{usd(caisse.byMode[m])}</strong></div>
                ))}
              </div>
            </div>
            <div className="toolbar">
              <span className="admin-sub" style={{ margin: 0 }}>{caisse.list.length} paiement(s)</span>
              <div className="spacer" />
              <button className="btn btn-outline btn-sm" onClick={exportCaisse} disabled={!caisse.list.length}>Exporter CSV</button>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Date</th><th>Élève</th><th>Frais</th><th>Montant</th><th>Mode</th><th>Reçu</th></tr></thead>
                <tbody>
                  {caisse.list.slice(0, 300).map((p) => (
                    <tr key={p.id}>
                      <td>{p.date_paiement}</td>
                      <td>{eleveNom(eleveById[p.eleve_id] || {})}</td>
                      <td>{p.frais?.libelle || '—'}</td>
                      <td>{Number(p.montant).toLocaleString('fr-FR')} {p.devise}</td>
                      <td>{(MODES.find(([m]) => m === p.mode) || [, p.mode])[1]}</td>
                      <td>{p.recu_numero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'releve' && (
          <div className="card-box">
            <div className="field" style={{ maxWidth: 420 }}>
              <label className="lbl">Élève</label>
              <select className="input" value={releveId} onChange={(e) => setReleveId(e.target.value)}>
                <option value="">— Choisir un élève —</option>
                {eleves.map((e) => <option key={e.id} value={e.id}>{eleveNom(e)}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {tab === 'releve' && releve && (
        <div id="print-root">
          <div className="bulletin-actions">
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Imprimer le relevé</button>
          </div>
          <Releve data={releve} />
        </div>
      )}
    </PercepteurLayout>
  );
}

function group(rows, key) {
  const m = {};
  (rows || []).forEach((r) => { (m[r[key]] = m[r[key]] || []).push(r); });
  return m;
}

// Tiny inline collection-rate bar.
function bar(p) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 70, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${p}%`, height: '100%', background: p >= 80 ? '#1c7c43' : p >= 40 ? '#f7c948' : '#ce1126' }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{p}%</span>
    </span>
  );
}
