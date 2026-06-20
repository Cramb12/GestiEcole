// Admin shell — top bar (from Layout) + a sidebar to navigate config screens.
import { NavLink } from 'react-router-dom';
import Layout from './Layout.jsx';

const LINKS = [
  { to: '/admin', label: 'Tableau de bord', icon: '🏠', end: true },
  { to: '/admin/configuration', label: 'École', icon: '⚙️' },
  { to: '/admin/classes', label: 'Classes', icon: '🏫' },
  { to: '/admin/matieres', label: 'Matières', icon: '📚' },
  { to: '/admin/enseignants', label: 'Enseignants', icon: '👩‍🏫' },
  { to: '/admin/periodes', label: 'Périodes', icon: '🗓️' },
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
              <span>{l.icon}</span> {l.label}
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
