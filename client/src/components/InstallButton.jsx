// "Install the app" button — appears only when the browser offers a PWA
// install prompt (Android/desktop Chrome, Edge…). Hidden once installed or on
// browsers that don't support it (e.g. iOS Safari, which uses Add to Home Screen).
import { useEffect, useState } from 'react';

export default function InstallButton({ className = 'btn lp-btn-light', label = "Installer l'application" }) {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  async function install() {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return <button type="button" className={className} onClick={install}>{label}</button>;
}
