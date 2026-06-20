// Shared layout — top bar with brand, user info, and logout.
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Layout({ children, ecoleNom }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const roleLabel = user?.role === 'super_admin' ? 'Administrateur' : 'Enseignant';

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="dot">🎓</span>
          <span>{ecoleNom || 'Gestion Scolaire'}</span>
        </div>
        <div className="user-box">
          <span className="who">
            {user?.nom} {user?.postnom || ''}
          </span>
          <span className="badge">{roleLabel}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
