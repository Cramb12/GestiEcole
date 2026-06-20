// Route guard — requires auth and (optionally) a specific role.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen">Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required and the user doesn't have it,
  // send them to their own dashboard.
  if (role && user.role !== role) {
    const home = user.role === 'super_admin' ? '/admin' : '/enseignant';
    return <Navigate to={home} replace />;
  }

  return children;
}
