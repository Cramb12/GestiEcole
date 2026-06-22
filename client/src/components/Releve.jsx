// Printable per-student payment statement (relevé de compte).
const MODE = { especes: 'Espèces', airtel: 'Airtel Money', orange: 'Orange Money', mpesa: 'M-Pesa', banque: 'Banque', autre: 'Autre' };
const money = (n, d) => `${Number(n || 0).toLocaleString('fr-FR')} ${d}`;
const usd = (n) => `${Number(n || 0).toFixed(2)} $`;

export default function Releve({ data }) {
  if (!data) return null;
  const { ecole, eleve, classe, paiements, due, paid, reste } = data;
  const nom = `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim();
  return (
    <div className="recu" style={{ maxWidth: '180mm' }}>
      <div className="recu-head">
        <div>
          <strong>{ecole?.nom_ecole || 'École'}</strong>
          <div className="recu-sub">{[ecole?.ville, ecole?.province].filter(Boolean).join(', ')}</div>
        </div>
        <div className="recu-no">Année {ecole?.annee_scolaire || ''}</div>
      </div>
      <div className="recu-title">RELEVÉ DE PAIEMENTS</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Élève :</strong> {nom}{classe ? ` — ${classe}` : ''}</div>

      <table className="recu-grid">
        <thead>
          <tr style={{ background: '#eee' }}><td>Date</td><td>Frais</td><td>Reçu</td><td>Mode</td><td style={{ textAlign: 'right' }}>Montant</td></tr>
        </thead>
        <tbody>
          {paiements.map((p) => (
            <tr key={p.id}>
              <td>{p.date_paiement}</td>
              <td>{p.frais?.libelle || '—'}{p.tranche_label ? ` (${p.tranche_label})` : ''}</td>
              <td>{p.recu_numero}</td>
              <td>{MODE[p.mode] || p.mode}</td>
              <td style={{ textAlign: 'right' }}>{money(p.montant, p.devise)}{p.devise !== 'USD' ? ` (${usd(p.montant_usd)})` : ''}</td>
            </tr>
          ))}
          {paiements.length === 0 && <tr><td colSpan={5}>Aucun paiement enregistré.</td></tr>}
        </tbody>
      </table>

      <div className="recu-foot" style={{ marginTop: 14 }}>
        <div>Total dû : <strong>{usd(due)}</strong> &nbsp;·&nbsp; Payé : <strong>{usd(paid)}</strong></div>
        <div>Reste à payer : <strong>{usd(reste)}</strong></div>
      </div>
    </div>
  );
}
