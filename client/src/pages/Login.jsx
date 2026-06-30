// Login page — email + password, with school logo placeholder.
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Demo credentials pre-filled when arriving from the landing page (?demo=1).
const DEMO = { email: 'directeur@ecole.cd', password: 'admin123' };

// Role-specific entry portals. Same login form, different heading; after
// sign-in everyone is routed to their own space, so no portal locks anyone out.
const PORTALS = {
  direction: { title: 'Espace Direction', sub: 'Connexion réservée à la direction' },
  enseignant: { title: 'Espace Enseignant', sub: 'Connexion réservée aux enseignants' },
  percepteur: { title: 'Espace Perception', sub: 'Connexion réservée au percepteur' },
  inscriptions: { title: 'Espace Inscriptions', sub: 'Connexion réservée au chargé des inscriptions' },
};

export default function Login({ variant }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isDemo = params.get('demo') === '1';
  const portal = PORTALS[variant] || null;

  const [email, setEmail] = useState(isDemo ? DEMO.email : '');
  const [password, setPassword] = useState(isDemo ? DEMO.password : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side validation (French messages).
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      const dest = user.isOwner ? '/vendeur'
        : user.role === 'super_admin' ? '/admin'
        : user.role === 'percepteur' ? '/percepteur'
        : user.role === 'inscripteur' ? '/inscriptions'
        : '/enseignant';
      navigate(dest, { replace: true });
    } catch (err) {
      // Map common Supabase Auth errors to French messages.
      const raw = (err?.message || '').toLowerCase();
      let msg = 'Connexion impossible. Vérifiez vos identifiants.';
      if (raw.includes('invalid login')) msg = 'Email ou mot de passe incorrect.';
      else if (raw.includes('email not confirmed')) msg = "Ce compte n'est pas encore confirmé.";
      else if (raw.includes('failed to fetch') || raw.includes('network'))
        msg = 'Serveur injoignable. Vérifiez la configuration Supabase.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo"><img src="/gestiecole.png" alt="GestiEcole" /></div>
        <div className="login-title">{portal ? portal.title : 'Système de Gestion Scolaire'}</div>
        <div className="login-sub">{portal ? portal.sub : 'République Démocratique du Congo'}</div>

        {isDemo && (
          <div className="alert-error" style={{ background: '#fff7e0', color: '#8a6d00', borderColor: '#f3d98a' }}>
            Mode démonstration — identifiants pré-remplis. Cliquez sur « Se connecter ».
          </div>
        )}

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

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="login-hint">
          Comptes de démonstration :<br />
          Direction → <strong>directeur@ecole.cd</strong> / admin123<br />
          Enseignant → <strong>demo.kalala@ecole.cd</strong> / demo2025<br />
          Percepteur → <strong>demo.percepteur@ecole.cd</strong> / demo2025
          <br />
          Pas encore de compte ? <Link to="/inscription" style={{ color: 'var(--bleu)', fontWeight: 600 }}>Créer mon école (essai gratuit)</Link>
          <br />
          <Link to="/" style={{ color: 'var(--bleu)', fontWeight: 600 }}>Retour à l'accueil</Link>
        </div>
      </form>
    </div>
  );
}
