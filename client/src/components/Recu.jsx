// Printable payment receipt. Rendered inside #print-root so the existing print
// CSS isolates it. Keeps the original currency; shows the USD equivalent.
const money = (n, d) => `${Number(n || 0).toLocaleString('fr-FR')} ${d}`;

export default function Recu({ data }) {
  if (!data) return null;
  const { ecole, eleve, paiement, frais, percepteur } = data;
  const nom = `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim();
  return (
    <div className="recu">
      <div className="recu-head">
        <div>
          <strong>{ecole?.nom_ecole || 'École'}</strong>
          <div className="recu-sub">{[ecole?.ville, ecole?.province].filter(Boolean).join(', ')}</div>
        </div>
        <div className="recu-no">REÇU N° {paiement.recu_numero || '—'}</div>
      </div>

      <div className="recu-title">REÇU DE PAIEMENT</div>

      <table className="recu-grid">
        <tbody>
          <tr><td>Date</td><td>{paiement.date_paiement}</td></tr>
          <tr><td>Élève</td><td>{nom}</td></tr>
          <tr><td>Frais</td><td>{frais?.libelle || '—'}{paiement.tranche_label ? ` — ${paiement.tranche_label}` : ''}</td></tr>
          <tr><td>Montant</td><td><strong>{money(paiement.montant, paiement.devise)}</strong>{paiement.devise !== 'USD' ? ` (≈ ${money(paiement.montant_usd, 'USD')})` : ''}</td></tr>
          <tr><td>Mode</td><td>{MODE[paiement.mode] || paiement.mode}</td></tr>
        </tbody>
      </table>

      <div className="recu-foot">
        <div>Reçu par : {percepteur || '—'}</div>
        <div className="recu-sign">Signature et cachet</div>
      </div>
    </div>
  );
}

const MODE = { especes: 'Espèces', airtel: 'Airtel Money', orange: 'Orange Money', mpesa: 'M-Pesa', banque: 'Banque', autre: 'Autre' };
