// Super Admin dashboard — school info, quick stats, navigation menu.
import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Navigation items. "ready: false" tiles are placeholders for later phases.
const MENU = [
  { ico: '⚙️', label: 'Configuration', ready: false },
  { ico: '👨‍🎓', label: 'Élèves', ready: false },
  { ico: '👩‍🏫', label: 'Enseignants', ready: false },
  { ico: '📝', label: 'Notes', ready: false },
  { ico: '🗓️', label: 'Présences', ready: false },
  { ico: '📄', label: 'Bulletins', ready: false },
  { ico: '📊', label: 'Rapports', ready: false },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/admin')
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.message || 'Impossible de charger le tableau de bord.')
      )
      .finally(() => setLoading(false));
  }, []);

  const ecole = data?.ecole;

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <div className="welcome">
        <h1>Bonjour, {user?.nom} 👋</h1>
        <p>
          {ecole ? ecole.nom_ecole : 'École non configurée'}
          {ecole?.annee_scolaire ? ` — Année scolaire ${ecole.annee_scolaire}` : ''}
        </p>
      </div>

      {loading && <div className="empty-state">Chargement des statistiques…</div>}
      {error && <div className="alert-error">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="value">{data.stats.eleves}</div>
              <div className="label">Nombre d'élèves</div>
            </div>
            <div className="stat-card j">
              <div className="value">{data.stats.classes}</div>
              <div className="label">Nombre de classes</div>
            </div>
            <div className="stat-card r">
              <div className="value">{data.stats.enseignants}</div>
              <div className="label">Nombre d'enseignants</div>
            </div>
          </div>

          {!ecole && (
            <div className="alert-error" style={{ marginBottom: 24 }}>
              ⚠️ Aucune école configurée. La configuration sera disponible en Phase 2.
            </div>
          )}

          <div className="section-title">Menu de navigation</div>
          <div className="nav-grid">
            {MENU.map((m) => (
              <div className="nav-tile" key={m.label}>
                <span className="ico">{m.ico}</span>
                {m.label}
                {!m.ready && <span className="soon">Bientôt disponible</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
