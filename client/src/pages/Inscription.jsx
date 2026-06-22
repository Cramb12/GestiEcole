// Public self-service signup — create a school (30-day trial) + its director.
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

// Default academic year: school year starts in August.
function defaultAnnee() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export default function Inscription() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [f, setF] = useState({
    nom_ecole: '', province: '', ville: '', annee_scolaire: defaultAnnee(),
    nom: '', postnom: '', email: '', password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!f.nom_ecole.trim() || !f.annee_scolaire.trim()) { setError("Le nom de l'école et l'année scolaire sont obligatoires."); return; }
    if (!f.nom.trim() || !f.email.trim() || !f.password) { setError('Renseignez votre nom, email et mot de passe.'); return; }
    if (f.password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }

    setLoading(true);
    try {
      const email = f.email.trim().toLowerCase();
      const { data, error: fnErr } = await supabase.functions.invoke('create-school', {
        body: {
          ecole: { nom_ecole: f.nom_ecole.trim(), province: f.province.trim(), ville: f.ville.trim(), annee_scolaire: f.annee_scolaire.trim() },
          admin: { nom: f.nom.trim(), postnom: f.postnom.trim(), email, password: f.password },
        },
      });
      // Edge function returns a JSON message on 4xx; surface it.
      if (fnErr) {
        let msg = "Inscription impossible. Réessayez.";
        try { const ctx = await fnErr.context?.json?.(); if (ctx?.message) msg = ctx.message; } catch { /* noop */ }
        throw new Error(msg);
      }
      if (data?.message) throw new Error(data.message);

      // Auto-login the new director.
      await login(email, f.password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" style={{ maxWidth: 540 }} onSubmit={submit}>
        <div className="login-logo"><img src="/gestiecole.png" alt="GestiEcole" /></div>
        <div className="login-title">Créer mon école</div>
        <div className="login-sub">Essai gratuit de 30 jours — sans engagement</div>

        {error && <div className="alert-error">{error}</div>}

        <div className="signup-section">Votre école</div>
        <div className="field">
          <label htmlFor="nom_ecole">Nom de l'école</label>
          <input id="nom_ecole" value={f.nom_ecole} onChange={(e) => up('nom_ecole', e.target.value)} placeholder="ex: Institut de la Réussite" />
        </div>
        <div className="signup-row">
          <div className="field">
            <label htmlFor="ville">Ville</label>
            <input id="ville" value={f.ville} onChange={(e) => up('ville', e.target.value)} placeholder="ex: Bukavu" />
          </div>
          <div className="field">
            <label htmlFor="province">Province</label>
            <input id="province" value={f.province} onChange={(e) => up('province', e.target.value)} placeholder="ex: Sud-Kivu" />
          </div>
          <div className="field">
            <label htmlFor="annee">Année scolaire</label>
            <input id="annee" value={f.annee_scolaire} onChange={(e) => up('annee_scolaire', e.target.value)} placeholder="2025-2026" />
          </div>
        </div>

        <div className="signup-section">Votre compte (directeur)</div>
        <div className="signup-row">
          <div className="field">
            <label htmlFor="nom">Nom</label>
            <input id="nom" value={f.nom} onChange={(e) => up('nom', e.target.value)} autoComplete="family-name" />
          </div>
          <div className="field">
            <label htmlFor="postnom">Post-nom</label>
            <input id="postnom" value={f.postnom} onChange={(e) => up('postnom', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Adresse email</label>
          <input id="email" type="email" value={f.email} onChange={(e) => up('email', e.target.value)} placeholder="vous@ecole.cd" autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" type="password" value={f.password} onChange={(e) => up('password', e.target.value)} placeholder="6 caractères minimum" autoComplete="new-password" />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Création…' : 'Créer mon école et commencer'}
        </button>

        <div className="login-hint">
          Vous avez déjà un compte ? <Link to="/login" style={{ color: 'var(--bleu)', fontWeight: 600 }}>Se connecter</Link>
          <br />
          <Link to="/" style={{ color: 'var(--bleu)', fontWeight: 600 }}>Retour à l'accueil</Link>
        </div>
      </form>
    </div>
  );
}
