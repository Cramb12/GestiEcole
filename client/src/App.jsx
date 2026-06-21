// App routes — role-based redirection + admin configuration screens.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Landing from './pages/Landing.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import Configuration from './pages/admin/Configuration.jsx';
import Classes from './pages/admin/Classes.jsx';
import Branches from './pages/admin/Branches.jsx';
import Enseignants from './pages/admin/Enseignants.jsx';
import Periodes from './pages/admin/Periodes.jsx';
import Eleves from './pages/admin/Eleves.jsx';
import EleveProfile from './pages/admin/EleveProfile.jsx';
import Sections from './pages/admin/Sections.jsx';
import AdminPresences from './pages/admin/Presences.jsx';
import TeacherPresences from './pages/teacher/Presences.jsx';
import AdminNotes from './pages/admin/Notes.jsx';
import TeacherNotes from './pages/teacher/Notes.jsx';
import Bulletins from './pages/admin/Bulletins.jsx';
import Rapports from './pages/admin/Rapports.jsx';
import BulletinEleve from './pages/admin/BulletinEleve.jsx';
import Horaire from './pages/admin/Horaire.jsx';
import Creneaux from './pages/admin/Creneaux.jsx';
import HoraireTeacher from './pages/teacher/Horaire.jsx';

// Public landing for visitors; logged-in users go straight to their dashboard.
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Chargement…</div>;
  if (!user) return <Landing />;
  return <Navigate to={user.role === 'super_admin' ? '/admin' : '/enseignant'} replace />;
}

// Helper to wrap an admin-only page.
function Admin({ children }) {
  return <ProtectedRoute role="super_admin">{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Super Admin */}
      <Route path="/admin" element={<Admin><AdminDashboard /></Admin>} />
      <Route path="/admin/configuration" element={<Admin><Configuration /></Admin>} />
      <Route path="/admin/classes" element={<Admin><Classes /></Admin>} />
      <Route path="/admin/matieres" element={<Admin><Branches /></Admin>} />
      <Route path="/admin/sections" element={<Admin><Sections /></Admin>} />
      <Route path="/admin/enseignants" element={<Admin><Enseignants /></Admin>} />
      <Route path="/admin/eleves" element={<Admin><Eleves /></Admin>} />
      <Route path="/admin/eleves/:id" element={<Admin><EleveProfile /></Admin>} />
      <Route path="/admin/eleves/:id/bulletin" element={<Admin><BulletinEleve /></Admin>} />
      <Route path="/admin/presences" element={<Admin><AdminPresences /></Admin>} />
      <Route path="/admin/notes" element={<Admin><AdminNotes /></Admin>} />
      <Route path="/admin/bulletins" element={<Admin><Bulletins /></Admin>} />
      <Route path="/admin/rapports" element={<Admin><Rapports /></Admin>} />
      <Route path="/admin/horaire" element={<Admin><Horaire /></Admin>} />
      <Route path="/admin/creneaux" element={<Admin><Creneaux /></Admin>} />
      <Route path="/admin/periodes" element={<Admin><Periodes /></Admin>} />

      {/* Teacher */}
      <Route
        path="/enseignant"
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enseignant/presences"
        element={
          <ProtectedRoute role="teacher">
            <TeacherPresences />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enseignant/notes"
        element={
          <ProtectedRoute role="teacher">
            <TeacherNotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enseignant/horaire"
        element={
          <ProtectedRoute role="teacher">
            <HoraireTeacher />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
