// Admin shell — top bar (from Layout) + a sidebar to navigate config screens.
import { NavLink } from 'react-router-dom';
import Layout from './Layout.jsx';

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
          {title && <h1 className="admin-h1">{title}</h1>}
          {subtitle && <p className="admin-sub">{subtitle}</p>}
          {children}
        </section>
      </div>
    </Layout>
  );
}
