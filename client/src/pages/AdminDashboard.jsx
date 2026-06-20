// Super Admin dashboard — school info, quick stats, navigation menu.
// Data is read directly from Supabase (protected by RLS: admin sees all).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Navigation items. Items with `to` are live; others are placeholders.
const MENU = [
  { label: "Configuration de l'école", to: '/admin/configuration' },
  { label: 'Classes', to: '/admin/classes' },
  { label: 'Matières', to: '/admin/matieres' },
  { label: 'Sections', to: '/admin/sections' },
  { label: 'Enseignants', to: '/admin/enseignants' },
  { label: 'Périodes', to: '/admin/periodes' },
  { label: 'Élèves', to: '/admin/eleves' },
  { label: 'Présences', to: '/admin/presences' },
  { label: 'Notes', ready: false },
  { label: 'Bulletins', ready: false },
  { label: 'Rapports', ready: false },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [ecole, setEcole] = useState(null);
  const [stats, setStats] = useState({ eleves: 0, classes: 0, enseignants: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // School info (single record).
        const { data: ecoleData, error: e1 } = await supabase
          .from('ecole')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (e1) throw e1;
        setEcole(ecoleData);

        const annee = ecoleData?.annee_scolaire;

        // Counts (head: true returns only the count, no rows).
        let elevesQ = supabase
          .from('eleves')
          .select('id', { count: 'exact', head: true })
          .eq('actif', true);
        let classesQ = supabase.from('classes').select('id', { count: 'exact', head: true });
        if (annee) {
          elevesQ = elevesQ.eq('annee_scolaire', annee);
          classesQ = classesQ.eq('annee_scolaire', annee);
        }
        const enseignantsQ = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'teacher')
          .eq('actif', true);

        const [elevesRes, classesRes, ensRes] = await Promise.all([elevesQ, classesQ, enseignantsQ]);

        setStats({
          eleves: elevesRes.count || 0,
          classes: classesRes.count || 0,
          enseignants: ensRes.count || 0,
        });
      } catch (err) {
        setError(err.message || 'Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <div className="welcome">
        <h1>Bonjour, {user?.nom}</h1>
        <p>
          {ecole ? ecole.nom_ecole : 'École non configurée'}
          {ecole?.annee_scolaire ? ` — Année scolaire ${ecole.annee_scolaire}` : ''}
        </p>
      </div>

      {loading && <div className="empty-state">Chargement des statistiques…</div>}
      {error && <div className="alert-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="value">{stats.eleves}</div>
              <div className="label">Nombre d'élèves</div>
            </div>
            <div className="stat-card j">
              <div className="value">{stats.classes}</div>
              <div className="label">Nombre de classes</div>
            </div>
            <div className="stat-card r">
              <div className="value">{stats.enseignants}</div>
              <div className="label">Nombre d'enseignants</div>
            </div>
          </div>

          {!ecole && (
            <div className="alert-error" style={{ marginBottom: 24 }}>
              Aucune école configurée. Renseignez-la dans « Configuration de l'école ».
            </div>
          )}

          <div className="section-title">Menu de navigation</div>
          <div className="nav-grid">
            {MENU.map((m) =>
              m.to ? (
                <Link className="nav-tile" key={m.label} to={m.to} style={{ textDecoration: 'none' }}>
                  {m.label}
                </Link>
              ) : (
                <div className="nav-tile" key={m.label}>
                  {m.label}
                  <span className="soon">Bientôt disponible</span>
                </div>
              )
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
