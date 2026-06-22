// Admin shell — top bar (from Layout) + a sidebar to navigate config screens.
import { NavLink } from 'react-router-dom';
import Layout from './Layout.jsx';
import { useEcole } from '../lib/useEcole.js';

const WA = 'https://wa.me/243973184702';

// Trial / subscription banner shown above the admin content.
function subscriptionBanner(ecole) {
  if (!ecole || ecole.statut === 'actif') return null;
  const today = new Date().toISOString().slice(0, 10);
  if (ecole.statut === 'essai' && ecole.essai_fin && ecole.essai_fin >= today) {
    const days = Math.max(1, Math.ceil((new Date(ecole.essai_fin) - new Date(today)) / 86400000));
    return { kind: 'info', text: `Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''} (jusqu'au ${ecole.essai_fin}).` };
  }
  return { kind: 'expired', text: "Votre essai est terminé : l'espace est en lecture seule. Activez votre abonnement pour continuer à modifier." };
}

const LINKS = [
  { to: '/admin', label: 'Tableau de bord', end: true },
  { to: '/admin/configuration', label: 'École' },
  { to: '/admin/classes', label: 'Classes' },
  { to: '/admin/matieres', label: 'Matières' },
  { to: '/admin/sections', label: 'Sections' },
  { to: '/admin/enseignants', label: 'Enseignants' },
  { to: '/admin/horaire', label: 'Emploi du temps' },
  { to: '/admin/eleves', label: 'Élèves' },
  { to: '/admin/presences', label: 'Présences' },
  { to: '/admin/notes', label: 'Notes' },
  { to: '/admin/bulletins', label: 'Bulletins' },
  { to: '/admin/rapports', label: 'Rapports' },
  { to: '/admin/periodes', label: 'Périodes' },
];

export default function AdminLayout({ title, subtitle, ecoleNom, children }) {
  const { ecole } = useEcole();
  const banner = subscriptionBanner(ecole);
  return (
    <Layout ecoleNom={ecoleNom}>
      <div className="admin-shell">
        <aside className="admin-side">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => 'side-link' + (isActive ? ' active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </aside>
        <section className="admin-content">
          {banner && (
            <div className={`sub-banner ${banner.kind}`}>
              <span>{banner.text}</span>
              <a href={WA} target="_blank" rel="noopener noreferrer">Activer mon abonnement</a>
            </div>
          )}
          {title && <h1 className="admin-h1">{title}</h1>}
          {subtitle && <p className="admin-sub">{subtitle}</p>}
          {children}
        </section>
      </div>
    </Layout>
  );
}
