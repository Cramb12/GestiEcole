// Dashboard controllers — stats for admin and teacher home screens.
import { query } from '../config/db.js';

// GET /api/dashboard/admin  (super_admin only)
// Returns school info + quick stats.
export async function adminDashboard(req, res, next) {
  try {
    const ecoleResult = await query(
      'SELECT * FROM ecole ORDER BY created_at ASC LIMIT 1'
    );
    const ecole = ecoleResult.rows[0] || null;
    const annee = ecole?.annee_scolaire || null;

    // Count students (active), classes, and teachers for the current year.
    const [eleves, classes, enseignants] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total FROM eleves
         WHERE actif = TRUE ${annee ? 'AND annee_scolaire = $1' : ''}`,
        annee ? [annee] : []
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM classes
         ${annee ? 'WHERE annee_scolaire = $1' : ''}`,
        annee ? [annee] : []
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM users WHERE role = 'teacher' AND actif = TRUE`
      ),
    ]);

    res.json({
      ecole,
      stats: {
        eleves: eleves.rows[0].total,
        classes: classes.rows[0].total,
        enseignants: enseignants.rows[0].total,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/teacher  (teacher) — the teacher's assigned class/subject cards.
export async function teacherDashboard(req, res, next) {
  try {
    const teacherId = req.user.id;

    const ecoleResult = await query(
      'SELECT nom_ecole, annee_scolaire FROM ecole ORDER BY created_at ASC LIMIT 1'
    );
    const ecole = ecoleResult.rows[0] || null;

    // All (subject + class) assignments for this teacher.
    const { rows: affectations } = await query(
      `SELECT eb.id,
              b.nom        AS branche,
              b.domaine    AS domaine,
              c.nom        AS classe,
              n.nom        AS niveau,
              n.type       AS niveau_type,
              eb.annee_scolaire
       FROM enseignant_branches eb
       JOIN branches b ON b.id = eb.branche_id
       JOIN classes  c ON c.id = eb.classe_id
       JOIN niveaux  n ON n.id = c.niveau_id
       WHERE eb.teacher_id = $1
       ORDER BY c.nom, b.ordre, b.nom`,
      [teacherId]
    );

    // Classes where this teacher is the titulaire (homeroom).
    const { rows: titulariat } = await query(
      `SELECT c.id, c.nom AS classe, n.nom AS niveau
       FROM classes c
       JOIN niveaux n ON n.id = c.niveau_id
       WHERE c.titulaire_id = $1
       ORDER BY c.nom`,
      [teacherId]
    );

    res.json({ ecole, affectations, titulariat });
  } catch (err) {
    next(err);
  }
}
