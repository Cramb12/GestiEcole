// Trial / subscription banner — shown above the admin and percepteur content.
const WA = 'https://wa.me/243973184702';

export default function SubscriptionBanner({ ecole }) {
  if (!ecole || ecole.statut === 'actif') return null;
  const today = new Date().toISOString().slice(0, 10);
  let kind, text;
  if (ecole.statut === 'essai' && ecole.essai_fin && ecole.essai_fin >= today) {
    const days = Math.max(1, Math.ceil((new Date(ecole.essai_fin) - new Date(today)) / 86400000));
    kind = 'info';
    text = `Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''} (jusqu'au ${ecole.essai_fin}).`;
  } else {
    kind = 'expired';
    text = "Votre essai est terminé : l'espace est en lecture seule. Activez votre abonnement pour continuer à modifier.";
  }
  return (
    <div className={`sub-banner ${kind}`}>
      <span>{text}</span>
      <a href={WA} target="_blank" rel="noopener noreferrer">Activer mon abonnement</a>
    </div>
  );
}
