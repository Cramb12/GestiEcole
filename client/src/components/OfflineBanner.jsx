// Global "you are offline" banner. Reassures the user that entries are kept on
// the device and will be sent once the connection returns (Étape 0).
import { useOnline } from '../hooks/useOnline.js';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner no-print">
      Hors ligne — vos saisies sont conservées sur cet appareil. Reconnectez-vous à Internet pour les envoyer.
    </div>
  );
}
