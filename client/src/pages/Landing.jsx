// Public landing page — commercial showcase for school directors (Bukavu/Goma).
// Lives at "/" for non-authenticated visitors. French UI, no emojis.
import { Link } from 'react-router-dom';

// ---- Contact details — EDIT THESE before sharing the page publicly. ----
const CONTACT = {
  whatsapp: '257XXXXXXXX',          // ex. 25761234567 (indicatif Burundi 257, sans +, sans espaces)
  email: 'contact@gestiecole.cd',   // adresse de contact commerciale
};
const WA_TEXT = encodeURIComponent(
  "Bonjour, je suis directeur(trice) d'une école et je souhaite une présentation de GestiEcole."
);
const waLink = `https://wa.me/${CONTACT.whatsapp}?text=${WA_TEXT}`;

// Small inline icon set (stroke style) — avoids emojis, stays self-contained.
function Icon({ name }) {
  const common = {
    width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  const paths = {
    bulletin: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" /></>,
    calc: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2M8 15h2M14 11h2M14 15h2" /></>,
    rank: <><path d="M4 20h4V10H4zM10 20h4V4h-4zM16 20h4v-7h-4z" /></>,
    students: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" /></>,
    presence: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="M9 15l2 2 4-4" /></>,
    horaire: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    import: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 21h16" /></>,
    shield: <><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

const FEATURES = [
  { icon: 'bulletin', titre: 'Bulletins officiels automatiques', texte: 'Le bulletin au format MINEDUC se remplit et se calcule tout seul. Prêt à imprimer en PDF, primaire comme secondaire.' },
  { icon: 'calc', titre: 'Carnet de cotes intelligent', texte: 'Devoirs, interrogations et examens. Les moyennes, totaux et points sont calculés automatiquement, sans erreur.' },
  { icon: 'rank', titre: 'Classement et rapports', texte: "Classement de la classe, matières en échec, élèves à risque, statistiques de l'école — en un clic." },
  { icon: 'students', titre: 'Élèves et enseignants', texte: 'Dossiers élèves, comptes enseignants par classe, inscriptions. Chaque enseignant ne voit que ses classes.' },
  { icon: 'presence', titre: 'Présences', texte: 'Suivi des absences et retards, intégrés directement aux rapports de discipline.' },
  { icon: 'horaire', titre: 'Emploi du temps', texte: "Horaire de l'école construit à partir des cours déjà affectés aux enseignants." },
  { icon: 'import', titre: 'Import par fichier (CSV)', texte: "Ajoutez des classes entières d'élèves en une seule fois depuis un fichier Excel." },
  { icon: 'shield', titre: 'Données sécurisées', texte: 'Chaque école dispose de son espace isolé. Sauvegarde dans le cloud, accessible partout.' },
];

export default function Landing() {
  return (
    <div className="lp">
      {/* ---- Barre de navigation ---- */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-logo">GE</span>
            <span>GestiEcole</span>
          </div>
          <div className="lp-nav-actions">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="lp-nav-link">Nous contacter</a>
            <Link to="/login?demo=1" className="btn lp-btn-light">Voir la démo</Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <span className="lp-eyebrow">Conforme aux normes MINEDUC — RDC</span>
            <h1>Les bulletins officiels de votre école, générés automatiquement.</h1>
            <p className="lp-lead">
              GestiEcole gère les notes, les bulletins, le classement et les rapports de votre établissement.
              Plus de calculs manuels. Plus d'erreurs. Plus de bulletins refaits à la main.
            </p>
            <div className="lp-hero-cta">
              <Link to="/login?demo=1" className="btn lp-btn-primary">Voir la démo en direct</Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn lp-btn-outline">Demander une présentation</a>
            </div>
            <p className="lp-hero-note">
              Conçu pour les écoles primaires et secondaires de Bukavu, Goma et de tout l'Est de la RDC.
            </p>
          </div>

          {/* Mini aperçu d'un bulletin (CSS pur) */}
          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-bulletin-card">
              <div className="lp-bull-head">
                <span className="lp-bull-flag" />
                <div>
                  <strong>BULLETIN SCOLAIRE</strong>
                  <small>Année 2025-2026 — 1ère période</small>
                </div>
              </div>
              <div className="lp-bull-rows">
                {[['Mathématiques', '16,5'], ['Français', '14,0'], ['Physique', '15,2'], ['Biologie', '13,8']].map(([m, n]) => (
                  <div className="lp-bull-row" key={m}><span>{m}</span><span>{n}</span></div>
                ))}
              </div>
              <div className="lp-bull-total"><span>POURCENTAGE</span><span>74,3 %</span></div>
              <div className="lp-bull-rank">Place : 2 / 16 — Application : Très bien</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Le problème ---- */}
      <section className="lp-section lp-pain">
        <h2 className="lp-h2">Vous reconnaissez ces difficultés ?</h2>
        <div className="lp-pain-grid">
          <div className="lp-pain-card"><h3>Des heures de calcul</h3><p>Les enseignants additionnent les notes à la main chaque fin de période. Long et source d'erreurs.</p></div>
          <div className="lp-pain-card"><h3>Des bulletins refaits</h3><p>Une erreur, et tout le bulletin est à recommencer. Chaque trimestre, la même corvée.</p></div>
          <div className="lp-pain-card"><h3>Pas de vue d'ensemble</h3><p>Difficile de produire un classement fiable ou de repérer rapidement les élèves en difficulté.</p></div>
        </div>
      </section>

      {/* ---- Fonctionnalités ---- */}
      <section className="lp-section">
        <h2 className="lp-h2">Tout ce dont votre école a besoin</h2>
        <p className="lp-sub">Une seule application, du carnet de cotes au bulletin officiel.</p>
        <div className="lp-feat-grid">
          {FEATURES.map((f) => (
            <div className="lp-feat-card" key={f.titre}>
              <div className="lp-feat-icon"><Icon name={f.icon} /></div>
              <h3>{f.titre}</h3>
              <p>{f.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Comment ça marche ---- */}
      <section className="lp-section lp-steps-wrap">
        <h2 className="lp-h2">Mise en route simple</h2>
        <div className="lp-steps">
          <div className="lp-step"><span className="lp-step-num">1</span><h3>Configuration</h3><p>Nous paramétrons votre école : classes, sections, matières et périodes officielles.</p></div>
          <div className="lp-step"><span className="lp-step-num">2</span><h3>Enseignants et élèves</h3><p>Les comptes enseignants sont créés et les élèves importés (saisie ou fichier Excel).</p></div>
          <div className="lp-step"><span className="lp-step-num">3</span><h3>Notes et bulletins</h3><p>Les enseignants saisissent les cotes. Les bulletins officiels sortent automatiquement.</p></div>
        </div>
      </section>

      {/* ---- Bandeau démo ---- */}
      <section className="lp-demo">
        <div className="lp-demo-inner">
          <div>
            <h2>Essayez l'école de démonstration</h2>
            <p>Un établissement fictif complet : élèves, notes, bulletins remplis et classement. Explorez librement.</p>
          </div>
          <div className="lp-demo-card">
            <div className="lp-demo-creds">
              <div><span>Direction</span><strong>directeur@ecole.cd</strong><em>admin123</em></div>
              <div><span>Enseignant</span><strong>demo.kalala@ecole.cd</strong><em>demo2025</em></div>
            </div>
            <Link to="/login?demo=1" className="btn lp-btn-primary" style={{ width: '100%' }}>Ouvrir la démo</Link>
          </div>
        </div>
      </section>

      {/* ---- Tarifs ---- */}
      <section className="lp-section lp-pricing">
        <h2 className="lp-h2">Un tarif accessible</h2>
        <p className="lp-sub">
          Abonnement annuel par établissement, adapté à la taille de votre école. Paiement par mobile money
          (Airtel Money, Orange Money, M-Pesa). Premières écoles pilotes à Bukavu et Goma : conditions spéciales.
        </p>
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn lp-btn-primary">Demander un devis</a>
      </section>

      {/* ---- Pied de page / contact ---- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-brand lp-brand-light">
            <span className="lp-logo">GE</span>
            <span>GestiEcole</span>
          </div>
          <div className="lp-footer-contact">
            <a href={waLink} target="_blank" rel="noopener noreferrer">WhatsApp : +{CONTACT.whatsapp}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <span>Bukavu — Goma, République Démocratique du Congo</span>
          </div>
        </div>
        <div className="lp-footer-bottom">GestiEcole — Système de gestion scolaire conforme aux normes MINEDUC.</div>
      </footer>
    </div>
  );
}
