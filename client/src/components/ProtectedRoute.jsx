// Route guard — requires auth and (optionally) a specific role.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, role, owner }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen">Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const home = user.isOwner ? '/vendeur'
    : user.role === 'super_admin' ? '/admin'
    : user.role === 'percepteur' ? '/percepteur'
    : user.role === 'inscripteur' ? '/inscriptions'
    : '/enseignant';

  // Platform-owner-only route.
  if (owner && !user.isOwner) {
    return <Navigate to={home} replace />;
  }

  // If specific role(s) are required and the user doesn't match, send them home.
  const roleOk = !role || (Array.isArray(role) ? role.includes(user.role) : user.role === role);
  if (!roleOk) {
    return <Navigate to={home} replace />;
  }

  return children;
}
