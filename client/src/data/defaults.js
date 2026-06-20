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

// --- Periods (periodes) by system -------------------------------------
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
