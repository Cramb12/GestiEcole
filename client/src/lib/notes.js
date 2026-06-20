// Marks helpers. A subject's `max_points` is the maximum PER PERIOD (M).
// Per the official bulletins, each trimester/semester is composed of:
//   Travaux Journaliers 1ère période  -> max M
//   Travaux Journaliers 2ème période  -> max M
//   Examen                            -> max 2M
//   Total de la période               -> max 4M
export function maxima(M) {
  const m = Number(M) || 0;
  return { tj1: m, tj2: m, exam: 2 * m, total: 4 * m };
}

// Total obtained for one period = TJ1 + TJ2 + Examen.
export function totalObtenu(n) {
  return (Number(n.j1) || 0) + (Number(n.j2) || 0) + (Number(n.exam) || 0);
}

// Does a branch (with its `annee`) apply to a class of year `classeAnnee`?
// Primary branches have annee = null (apply to the whole level). Combined
// bulletins use a range like '1-2'.
export function brancheApplies(brancheAnnee, classeAnnee) {
  if (!brancheAnnee) return true;
  if (!classeAnnee) return true;
  if (brancheAnnee === classeAnnee) return true;
  if (brancheAnnee.includes('-')) return brancheAnnee.split('-').includes(String(classeAnnee));
  return false;
}

// Rank a list of {key, pct} desc, returning {key -> place}. Ties share a place.
export function ranking(items) {
  const sorted = [...items].sort((a, b) => b.pct - a.pct);
  const place = {};
  let lastPct = null, lastPlace = 0;
  sorted.forEach((it, i) => {
    if (lastPct === null || it.pct !== lastPct) { lastPlace = i + 1; lastPct = it.pct; }
    place[it.key] = lastPlace;
  });
  return place;
}
