// Teacher dashboard — assigned classes + subjects, read from Supabase.
// RLS ensures a teacher only sees their own assignments.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const QUICK = ['Présences', 'Notes', 'Bulletins'];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [ecole, setEcole] = useState(null);
  const [affectations, setAffectations] = useState([]);
  const [titulariat, setTitulariat] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        // School (for the header).
        const { data: ecoleData } = await supabase
          .from('ecole')
          .select('nom_ecole, annee_scolaire')
          .limit(1)
          .maybeSingle();
        setEcole(ecoleData);

        // Assignments: subject + class (+ level) via foreign-key joins.
        const { data: aff, error: e1 } = await supabase
          .from('enseignant_branches')
          .select('id, annee_scolaire, branches(nom, domaine, ordre), classes(nom, niveaux(nom, type))')
          .eq('teacher_id', user.id);
        if (e1) throw e1;

        // Flatten the nested shape for easy rendering.
        const flat = (aff || []).map((a) => ({
          id: a.id,
          branche: a.branches?.nom || '—',
          domaine: a.branches?.domaine || a.classes?.niveaux?.nom || '',
          classe: a.classes?.nom || '—',
          ordre: a.branches?.ordre ?? 0,
        }));
        flat.sort((x, y) => x.classe.localeCompare(y.classe) || x.ordre - y.ordre);
        setAffectations(flat);

        // Classes where this teacher is the titulaire (homeroom).
        const { data: tit } = await supabase
          .from('classes')
          .select('id, nom, niveaux(nom)')
          .eq('titulaire_id', user.id);
        setTitulariat(
          (tit || []).map((c) => ({ id: c.id, classe: c.nom, niveau: c.niveaux?.nom || '' }))
        );
      } catch (err) {
        setError(err.message || 'Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  return (
    <Layout ecoleNom={ecole?.nom_ecole}>
      <div className="welcome">
        <h1>Bonjour, {user?.nom}</h1>
        <p>
          Bienvenue sur votre espace enseignant
          {ecole?.annee_scolaire ? ` — Année ${ecole.annee_scolaire}` : ''}
        </p>
      </div>

      {loading && <div className="empty-state">Chargement…</div>}
      {error && <div className="alert-error">{error}</div>}

      {!loading && !error && (
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
              L'administrateur vous attribuera des matières et des classes.
            </div>
          ) : (
            <div className="assign-grid">
              {affectations.map((a) => (
                <div className="assign-card" key={a.id}>
                  <div className="branche">{a.branche}</div>
                  <div className="meta">{a.domaine}</div>
                  <span className="classe-pill">{a.classe}</span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title" style={{ marginTop: 28 }}>Accès rapide</div>
          <div className="nav-grid">
            {QUICK.map((label) => (
              <div className="nav-tile" key={label}>
                {label}
                <span className="soon">Bientôt disponible</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
