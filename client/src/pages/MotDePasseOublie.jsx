// "Mot de passe oublié" — step 1: request a reset link by email.
// Supabase emails a recovery link that lands on /reset-password.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Veuillez saisir votre adresse email.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Don't reveal whether the email exists — show success either way, except
    // for an explicit rate-limit message.
    if (err && /rate|seconds|too many/i.test(err.message)) {
      setError('Trop de tentatives. Réessayez dans quelques minutes.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><img src="/gestiecole.png" alt="GestiEcole" /></div>
        <div className="login-title">Mot de passe oublié</div>
        <div className="login-sub">Recevez un lien de réinitialisation par email</div>

        {sent ? (
          <>
            <div className="alert-success">
              Si un compte existe pour cette adresse, un email contenant un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos courriers indésirables (spam).
            </div>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Retour à la connexion</Link>
          </>
        ) : (
          <>
            {error && <div className="alert-error">{error}</div>}
            <div className="field">
              <label htmlFor="email">Adresse email</label>
              <input
                id="email"
                type="email"
                placeholder="exemple@ecole.cd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <div className="login-hint">
              <Link to="/login" style={{ color: 'var(--bleu)', fontWeight: 600 }}>Retour à la connexion</Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
