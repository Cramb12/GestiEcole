// Login page — email + password, with school logo placeholder.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      navigate(user.role === 'super_admin' ? '/admin' : '/enseignant', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Connexion impossible. Vérifiez vos identifiants ou le serveur.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">🎓</div>
        <div className="login-title">Système de Gestion Scolaire</div>
        <div className="login-sub">République Démocratique du Congo</div>

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
          Comptes de test :<br />
          Admin → <strong>directeur@ecole.cd</strong> / admin123<br />
          Enseignant → <strong>enseignant@ecole.cd</strong> / prof123
        </div>
      </form>
    </div>
  );
}
