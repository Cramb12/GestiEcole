// "Mot de passe oublié" — step 2: set a new password.
// Reached from the recovery link in the email. Supabase's client detects the
// recovery token in the URL and opens a temporary session; we then update the
// password and send the user back to the login page.
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function ReinitialiserMotDePasse() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);   // a recovery session was detected
  const [checked, setChecked] = useState(false); // finished checking for one
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link establishes a temporary session (PASSWORD_RECOVERY).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setReady(true); setChecked(true); }
    });
    // Also handle the case where the token was already processed before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setLoading(false); setError(err.message); return; }
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><img src="/gestiecole.png" alt="GestiEcole" /></div>
        <div className="login-title">Nouveau mot de passe</div>
        <div className="login-sub">Choisissez un nouveau mot de passe</div>

        {done ? (
          <div className="alert-success">
            Mot de passe modifié. Vous allez être redirigé vers la page de connexion…
          </div>
        ) : !checked ? (
          <div className="empty-state">Vérification du lien…</div>
        ) : !ready ? (
          <>
            <div className="alert-error">
              Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation.
            </div>
            <Link to="/mot-de-passe-oublie" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Demander un nouveau lien</Link>
          </>
        ) : (
          <>
            {error && <div className="alert-error">{error}</div>}
            <div className="field">
              <label htmlFor="password">Nouveau mot de passe</label>
              <input
                id="password"
                type="password"
                placeholder="min. 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirmer le mot de passe</label>
              <input
                id="confirm"
                type="password"
                placeholder="Retapez le mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
