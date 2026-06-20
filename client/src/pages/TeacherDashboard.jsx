// Teacher dashboard — assigned classes + subjects, quick access tiles.
import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const QUICK = [
  { ico: '🗓️', label: 'Présences' },
  { ico: '📝', label: 'Notes' },
  { ico: '📄', label: 'Bulletins' },
];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/teacher')
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.message || 'Impossible de charger le tableau de bord.')
      )
      .finally(() => setLoading(false));
  }, []);

  const affectations = data?.affectations || [];
  const titulariat = data?.titulariat || [];

  return (
    <Layout ecoleNom={data?.ecole?.nom_ecole}>
      <div className="welcome">
        <h1>Bonjour, {user?.nom} 👋</h1>
        <p>
          Bienvenue sur votre espace enseignant
          {data?.ecole?.annee_scolaire ? ` — Année ${data.ecole.annee_scolaire}` : ''}
        </p>
      </div>

      {loading && <div className="empty-state">Chargement…</div>}
      {error && <div className="alert-error">{error}</div>}

      {data && (
        <>
          {titulariat.length > 0 && (
            <>
              <div className="section-title">Classe(s) dont vous êtes titulaire</div>
              <div className="assign-grid" style={{ marginBottom: 24 }}>
                {titulariat.map((t) => (
                  <div className="assign-card" key={t.id}>
                    <div className="branche">{t.classe}</div>
                    <div className="meta">Titulaire — {t.niveau}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Mes cours assignés</div>
          {affectations.length === 0 ? (
            <div className="empty-state">
              Aucun cours ne vous est encore assigné.<br />
              L'administrateur vous attribuera des matières et des classes (Phase 2).
            </div>
          ) : (
            <div className="assign-grid">
              {affectations.map((a) => (
                <div className="assign-card" key={a.id}>
                  <div className="branche">{a.branche}</div>
                  <div className="meta">
                    {a.domaine || a.niveau}
                  </div>
                  <span className="classe-pill">📚 {a.classe}</span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title" style={{ marginTop: 28 }}>Accès rapide</div>
          <div className="nav-grid">
            {QUICK.map((q) => (
              <div className="nav-tile" key={q.label}>
                <span className="ico">{q.ico}</span>
                {q.label}
                <span className="soon">Bientôt disponible</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
