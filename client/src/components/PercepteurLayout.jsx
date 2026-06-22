// Shell for the percepteur (cashier) space — top bar + slim nav + trial banner.
import { NavLink } from 'react-router-dom';
import Layout from './Layout.jsx';
import { useEcole } from '../lib/useEcole.js';
import SubscriptionBanner from './SubscriptionBanner.jsx';

const LINKS = [
  { to: '/percepteur', label: 'Encaisser', end: true },
  { to: '/percepteur/rapports', label: 'Rapports' },
];

export default function PercepteurLayout({ title, subtitle, children }) {
  const { ecole } = useEcole();
  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <div>
        <nav className="pl-nav no-print">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => 'pl-link' + (isActive ? ' active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="no-print">
          <SubscriptionBanner ecole={ecole} />
          {title && <h1 className="admin-h1">{title}</h1>}
          {subtitle && <p className="admin-sub">{subtitle}</p>}
        </div>
        {children}
      </div>
    </Layout>
  );
}
