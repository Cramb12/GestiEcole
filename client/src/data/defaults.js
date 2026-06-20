// Default DRC curriculum data, used to pre-load subjects and periods.
// These are sensible starting points — the admin can edit/extend them.

// --- Subjects (branches) by level type --------------------------------
// max_points are defaults the admin can change per the official maxima.
export const BRANCHES_PRIMAIRE = [
  { nom: 'Français', domaine: 'Domaine des Langues', max_points: 40 },
  { nom: 'Langues nationales', domaine: 'Domaine des Langues', max_points: 20 },
  { nom: 'Mathématiques', domaine: 'Domaine des Mathématiques Sciences et Technologie', max_points: 40 },
  { nom: 'Éveil scientifique', domaine: 'Domaine des Mathématiques Sciences et Technologie', max_points: 20 },
  { nom: 'Éducation à la citoyenneté', domaine: "Domaine de l'Univers Social et Environnement", max_points: 20 },
  { nom: 'Histoire - Géographie', domaine: "Domaine de l'Univers Social et Environnement", max_points: 20 },
  { nom: 'Éducation artistique', domaine: 'Domaine des Arts', max_points: 20 },
  { nom: 'Éducation physique et sportive', domaine: 'Domaine du Développement Personnel', max_points: 20 },
  { nom: 'Religion / Éducation morale', domaine: 'Domaine du Développement Personnel', max_points: 20 },
];

export const BRANCHES_SECONDAIRE = [
  { nom: 'Mathématiques', domaine: 'Domaine des Sciences', max_points: 40 },
  { nom: 'Sciences de la Vie (Biologie)', domaine: 'Domaine des Sciences', max_points: 20 },
  { nom: 'Sciences Physiques (Physique-Chimie)', domaine: 'Domaine des Sciences', max_points: 20 },
  { nom: 'TIC', domaine: 'Domaine des Sciences', max_points: 10 },
  { nom: 'Français', domaine: 'Domaine des Langues', max_points: 40 },
  { nom: 'Anglais', domaine: 'Domaine des Langues', max_points: 20 },
  { nom: 'Histoire', domaine: "Domaine de l'Univers Social", max_points: 20 },
  { nom: 'Géographie', domaine: "Domaine de l'Univers Social", max_points: 20 },
  { nom: 'Éducation à la citoyenneté', domaine: "Domaine de l'Univers Social", max_points: 10 },
  { nom: 'Éducation artistique', domaine: 'Domaine des Arts', max_points: 10 },
  { nom: 'Éducation physique et sportive', domaine: 'Domaine du Développement Personnel', max_points: 10 },
  { nom: 'Religion / Éducation morale', domaine: 'Domaine du Développement Personnel', max_points: 10 },
];

// Returns the default subject list for a given level type.
export function defaultBranches(niveauType) {
  return niveauType === 'secondaire' ? BRANCHES_SECONDAIRE : BRANCHES_PRIMAIRE;
}

// --- Sections d'humanités (officielles MINEDUC 2024-2025, par ordre alphabétique) ---
export const DEFAULT_SECTIONS = [
  { nom: 'Agriculture Générale', code: 'AGRI' },
  { nom: 'Arts Plastiques', code: 'ART' },
  { nom: 'Coiffure', code: 'COIF' },
  { nom: 'Construction', code: 'CONS' },
  { nom: 'Éducation Physique', code: 'EPS' },
  { nom: 'Électricité Générale', code: 'ELEC' },
  { nom: 'Foresterie', code: 'FOR' },
  { nom: "Technique d'Hébergement", code: 'HEB' },
  { nom: 'Hôtellerie et Restauration', code: 'HOTR' },
  { nom: 'Hydro-Pneumatique', code: 'HYDR' },
  { nom: 'Industries Agricoles', code: 'INDA' },
  { nom: 'Latin – Philosophie', code: 'LP' },
  { nom: 'Latin – Grec', code: 'LG' },
  { nom: 'Latin – Mathématiques', code: 'LM' },
  { nom: 'Mécanique / Machines-Outils', code: 'MMO' },
  { nom: 'Menuiserie – Ébénisterie', code: 'MEN' },
  { nom: 'Mécanique Automobile', code: 'MECA' },
  { nom: 'Musique', code: 'MUS' },
  { nom: 'Nutrition', code: 'NUT' },
  { nom: 'Pêche et Navigation', code: 'PEN' },
  { nom: 'Pédagogie Générale', code: 'PEDG' },
  { nom: 'Pédagogie Générale / Cycle Court', code: 'PGCC' },
  { nom: 'Pédagogie Maternelle', code: 'PEDM' },
  { nom: 'Pédagogie Pré-Scolaire', code: 'PEDP' },
  { nom: 'Scientifique', code: 'SCI' },
  { nom: 'Secrétariat & Administration', code: 'SEC' },
  { nom: 'Sociale', code: 'SOC' },
  { nom: 'Vétérinaire', code: 'VET' },
];

// --- Periods (periodes) by system -------------------------------------
// Document MINEDUC : le primaire a 3 trimestres (2 périodes chacun = 6
// périodes), le secondaire a 2 semestres (2 périodes chacun = 4 périodes).
// Chaque trimestre/semestre = 2 périodes de Travaux Journaliers + 1 Examen.
export function defaultPeriodes(systeme) {
  if (systeme === 'semestre') {
    return [
      { nom: '1er Semestre', type: 'semestre', numero: 1 },
      { nom: '2ème Semestre', type: 'semestre', numero: 2 },
    ];
  }
  return [
    { nom: '1er Trimestre', type: 'trimestre', numero: 1 },
    { nom: '2ème Trimestre', type: 'trimestre', numero: 2 },
    { nom: '3ème Trimestre', type: 'trimestre', numero: 3 },
  ];
}

// Labels of the 2 Travaux-Journaliers sub-periods inside a trimester/semester
// (as printed on the official bulletin: 1ère P., 2e P., 3e P., …).
export function subPeriodes(numero) {
  const a = numero * 2 - 1;
  const b = numero * 2;
  const ord = (n) => (n === 1 ? '1ère' : `${n}ème`);
  return [`${ord(a)} période`, `${ord(b)} période`];
}
