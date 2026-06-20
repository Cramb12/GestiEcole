// Minimal seed for Phase 1 testing:
//  - 1 school (ecole)
//  - the 5 DRC levels (niveaux)
//  - 1 super_admin + 1 teacher (with hashed passwords)
//  - 1 class + a couple of branches + 1 teacher assignment
// Run with: npm run seed
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../src/config/db.js';

dotenv.config();

const ANNEE = '2025-2026';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Initialisation des données de test...');
    await client.query('BEGIN');

    // --- École -----------------------------------------------------
    const ecoleRes = await client.query(
      `INSERT INTO ecole (nom_ecole, province, ville, commune, code_ecole, annee_scolaire)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      ['Institut de la Réussite', 'Sud-Kivu', 'Bukavu', 'Ibanda', 'EP-0001', ANNEE]
    );
    console.log('  ✔ École créée');

    // --- Niveaux (les 5 templates de bulletin) --------------------
    const niveaux = [
      ['Élémentaire', 'primaire', 'trimestre', 'elementaire'],
      ['Moyen', 'primaire', 'trimestre', 'moyen'],
      ['Terminal', 'primaire', 'trimestre', 'terminal'],
      ['7ème CTEB', 'secondaire', 'semestre', 'cteb'],
      ['Humanités', 'secondaire', 'semestre', 'humanites'],
    ];
    const niveauIds = {};
    for (const [nom, type, sys, tpl] of niveaux) {
      const r = await client.query(
        `INSERT INTO niveaux (nom, type, systeme_periodes, bulletin_template)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [nom, type, sys, tpl]
      );
      niveauIds[tpl] = r.rows[0].id;
    }
    console.log('  ✔ 5 niveaux créés');

    // --- Utilisateurs ---------------------------------------------
    const adminHash = await bcrypt.hash('admin123', 10);
    const profHash = await bcrypt.hash('prof123', 10);

    await client.query(
      `INSERT INTO users (nom, postnom, email, password, role)
       VALUES ($1,$2,$3,$4,'super_admin')`,
      ['Directeur', 'Général', 'directeur@ecole.cd', adminHash]
    );

    const profRes = await client.query(
      `INSERT INTO users (nom, postnom, email, password, role)
       VALUES ($1,$2,$3,$4,'teacher') RETURNING id`,
      ['Kamau', 'Jean', 'enseignant@ecole.cd', profHash]
    );
    const teacherId = profRes.rows[0].id;
    console.log('  ✔ 1 admin + 1 enseignant créés');

    // --- 1 classe (niveau Élémentaire), titulaire = l'enseignant --
    const classeRes = await client.query(
      `INSERT INTO classes (nom, niveau_id, annee_scolaire, titulaire_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['1ère A', niveauIds.elementaire, ANNEE, teacherId]
    );
    const classeId = classeRes.rows[0].id;

    // --- 2 branches d'exemple -------------------------------------
    const b1 = await client.query(
      `INSERT INTO branches (nom, domaine, max_points, niveau_id, ordre)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['Français', 'Domaine des Langues', 40, niveauIds.elementaire, 1]
    );
    await client.query(
      `INSERT INTO branches (nom, domaine, max_points, niveau_id, ordre)
       VALUES ($1,$2,$3,$4,$5)`,
      ['Mathématiques', 'Domaine des Mathématiques Sciences et Technologie', 40, niveauIds.elementaire, 2]
    );

    // --- 1 affectation enseignant ↔ branche ↔ classe --------------
    await client.query(
      `INSERT INTO enseignant_branches (teacher_id, branche_id, classe_id, annee_scolaire)
       VALUES ($1,$2,$3,$4)`,
      [teacherId, b1.rows[0].id, classeId, ANNEE]
    );
    console.log('  ✔ 1 classe, 2 branches, 1 affectation créées');

    await client.query('COMMIT');
    console.log('\n✅ Données de test insérées avec succès !');
    console.log('\n   Comptes de connexion :');
    console.log('   • Super Admin  → directeur@ecole.cd / admin123');
    console.log('   • Enseignant   → enseignant@ecole.cd / prof123\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Échec du seed :', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
