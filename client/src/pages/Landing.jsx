// Public landing page — commercial showcase for school directors (Bukavu/Goma).
// Lives at "/" for non-authenticated visitors. French UI, no emojis.
import { Link } from 'react-router-dom';

// ---- Contact details. ----
const CONTACT = {
  whatsapp: '243973184702',         // wa.me number (indicatif RDC 243, sans +, sans espaces)
  telephone: '+243 973 184 702',    // affichage lisible
  email: 'gesti.ecole@gmail.com',   // adresse de contact commerciale
};
const WA_TEXT = encodeURIComponent(
  "Bonjour, je suis directeur(trice) d'une école et je souhaite une présentation de GestiEcole."
);
const waLink = `https://wa.me/${CONTACT.whatsapp}?text=${WA_TEXT}`;

// WhatsApp glyph for the contact buttons.
function WaIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.13c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

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

// DRC flag — same construction as the real Bulletin component (sky blue field,
// yellow-bordered red diagonal, yellow star).
function MiniFlag() {
  return (
    <svg viewBox="0 0 90 60" className="lp-mb-flag" preserveAspectRatio="none" aria-hidden="true">
      <rect width="90" height="60" fill="#0086ce" />
      <line x1="0" y1="60" x2="90" y2="0" stroke="#f7d116" strokeWidth="16" />
      <line x1="0" y1="60" x2="90" y2="0" stroke="#ce1021" strokeWidth="10" />
      <polygon points="16,6 17.57,10.84 22.66,10.84 18.54,13.83 20.12,18.66 16,15.67 11.88,18.66 13.46,13.83 9.34,10.84 14.43,10.84" fill="#f7d116" />
    </svg>
  );
}

// Faithful, compact reproduction of a real DRC secondary (Humanités) bulletin —
// semester system, per-period columns, domains, sous-totaux, official footer.
// Static showcase data (Institut de la Réussite, demo school).
function MiniBulletin() {
  const SCIENCES = [
    { n: 'Mathématiques', max: 40, p1: 8, p2: 8, ex: 16, tot: 32 },
    { n: 'Physique', max: 40, p1: 7, p2: 8, ex: 16, tot: 31 },
    { n: 'Chimie', max: 40, p1: 7, p2: 7, ex: 15, tot: 29 },
    { n: 'Biologie', max: 40, p1: 7, p2: 8, ex: 15, tot: 30 },
  ];
  const LANGUES = [
    { n: 'Français', max: 40, p1: 7, p2: 6, ex: 15, tot: 28 },
    { n: 'Anglais', max: 40, p1: 6, p2: 7, ex: 15, tot: 28 },
  ];
  const Row = ({ c }) => (
    <tr>
      <td className="lp-mb-br">{c.n}</td>
      <td>{c.max}</td><td>{c.p1}</td><td>{c.p2}</td><td>{c.ex}</td><td className="lp-mb-b">{c.tot}</td>
    </tr>
  );
  return (
    <div className="lp-mb">
      <div className="lp-mb-top">
        <MiniFlag />
        <div className="lp-mb-ministry">
          <div>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</div>
          <div>MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
        </div>
        <span className="lp-mb-arms">RDC</span>
      </div>

      <div className="lp-mb-id">
        <span><b>ÉCOLE :</b> Institut de la Réussite</span>
        <span><b>CLASSE :</b> 1ère Hum. Scientifique</span>
      </div>
      <div className="lp-mb-id">
        <span><b>ÉLÈVE :</b> Chibalonza Mwendapeke</span>
        <span><b>N° PERM. :</b> 0420</span>
      </div>

      <div className="lp-mb-title">BULLETIN — 1ère ANNÉE HUMANITÉS / SCIENTIFIQUE — 2025-2026</div>

      <table className="lp-mb-grid">
        <thead>
          <tr>
            <th rowSpan={2} className="lp-mb-br">BRANCHES</th>
            <th colSpan={5}>1er SEMESTRE</th>
          </tr>
          <tr>
            <th>MAX.</th><th>1ère P.</th><th>2è P.</th><th>EXAM.</th><th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <tr className="lp-mb-dom"><td colSpan={6}>SCIENCES</td></tr>
          {SCIENCES.map((c) => <Row c={c} key={c.n} />)}
          <tr className="lp-mb-dom"><td colSpan={6}>LANGUES</td></tr>
          {LANGUES.map((c) => <Row c={c} key={c.n} />)}
          <tr className="lp-mb-gen">
            <td className="lp-mb-br">MAXIMA GÉNÉRAUX</td>
            <td>240</td><td></td><td></td><td></td><td className="lp-mb-b">178</td>
          </tr>
          <tr className="lp-mb-foot"><td className="lp-mb-br">POURCENTAGE</td><td colSpan={5}><b>74,2 %</b></td></tr>
          <tr className="lp-mb-foot"><td className="lp-mb-br">PLACE / NBRE</td><td colSpan={5}>2 / 16</td></tr>
          <tr className="lp-mb-foot"><td className="lp-mb-br">DÉCISION</td><td colSpan={5}><b>PASSE</b></td></tr>
        </tbody>
      </table>

      <div className="lp-mb-ref">Réf. IGE/PS/059 — Bulletin officiel de l'enseignement secondaire</div>
    </div>
  );
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
            <span className="lp-logo-chip"><img src="/gestiecole.png" alt="GestiEcole" /></span>
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
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn lp-btn-outline"><WaIcon /> Demander une présentation</a>
            </div>
            <p className="lp-hero-note">
              Conçu pour les écoles primaires et secondaires de Bukavu, Goma et de tout l'Est de la RDC.
            </p>
          </div>

          {/* Aperçu fidèle d'un vrai bulletin de l'enseignement secondaire (Humanités) */}
          <div className="lp-hero-visual" aria-hidden="true">
            <MiniBulletin />
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
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn lp-btn-primary"><WaIcon /> Demander un devis</a>
      </section>

      {/* ---- Pied de page / contact ---- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <div className="lp-brand lp-brand-light">
              <span className="lp-logo-chip"><img src="/gestiecole.png" alt="GestiEcole" /></span>
              <span>GestiEcole</span>
            </div>
            <p className="lp-footer-tag">Système de gestion scolaire conforme aux normes MINEDUC.</p>
          </div>
          <div className="lp-footer-contact">
            <a href={`tel:+${CONTACT.whatsapp}`}>Téléphone : {CONTACT.telephone}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <span>Bukavu — Goma, République Démocratique du Congo</span>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn lp-btn-wa"><WaIcon /> Écrire sur WhatsApp</a>
          </div>
        </div>
        <div className="lp-footer-bottom">GestiEcole — {CONTACT.telephone} — {CONTACT.email}</div>
      </footer>
    </div>
  );
}
