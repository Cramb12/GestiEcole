// Renders one student's official-style bulletin (A4 landscape).
// Works for both trimester (primary) and semester (secondary) systems.
const v = (x) => (x === null || x === undefined || x === '' ? '' : x);
const fmt = (x) => (x === null || x === undefined ? '' : Number(x).toFixed(Number.isInteger(Number(x)) ? 0 : 1));

export default function Bulletin({ data }) {
  if (!data) return null;
  const { ecole, eleve, classe, niveau, system, ref, titre, periodes, domaines, totals, pourcentage, place, nbreEleves, appreciation, approuve } = data;

  const perLabel = system === 'semestre' ? 'Sem.' : 'Trim.';
  const nbCols = 4; // TJ1, TJ2, Examen, Total per period
  const totalColspan = 1 + periodes.length * nbCols + 2; // branches + periods + (total + max)

  const fullName = `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const naissance = [eleve.lieu_naissance, eleve.date_naissance].filter(Boolean).join(' le ');

  return (
    <div className="bulletin">
      {!approuve && <div className="b-watermark">PROVISOIRE</div>}

      <div className="b-head">
        <div className="b-pays">RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</div>
        <div className="b-min">MINISTÈRE DE L'ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ</div>
      </div>

      <div className="b-meta">
        <div className="b-box">
          <div><b>Province :</b> {v(ecole?.province)}</div>
          <div><b>Ville :</b> {v(ecole?.ville)}</div>
          <div><b>Commune / Terr. :</b> {v(ecole?.commune)}</div>
          <div><b>École :</b> {v(ecole?.nom_ecole)}</div>
          <div><b>Code :</b> {v(ecole?.code_ecole)}</div>
        </div>
        <div className="b-box">
          <div><b>Élève :</b> {fullName}</div>
          <div><b>Sexe :</b> {v(eleve.sexe)}</div>
          <div><b>Né(e) à :</b> {v(naissance)}</div>
          <div><b>Classe :</b> {v(classe?.nom)}{classe?.sections ? ' — ' + classe.sections.nom : ''}</div>
          <div><b>N° Perm. :</b> {v(eleve.numero_perm)}</div>
        </div>
      </div>

      <div className="b-title">{titre} — Année scolaire {v(ecole?.annee_scolaire)} — Réf. {ref}</div>

      <table className="b-grid">
        <thead>
          <tr>
            <th rowSpan={2} style={{ minWidth: 130, textAlign: 'left' }}>BRANCHES</th>
            {periodes.map((p) => <th key={p.id} colSpan={nbCols}>{p.nom}</th>)}
            <th rowSpan={2}>TOTAL</th>
            <th rowSpan={2}>MAX</th>
          </tr>
          <tr>
            {periodes.map((p) => (
              <>
                <th key={p.id + 'a'}>TJ1</th>
                <th key={p.id + 'b'}>TJ2</th>
                <th key={p.id + 'c'}>Exam</th>
                <th key={p.id + 'd'}>Tot</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {domaines.map((dom, di) => (
            <>
              <tr className="b-domaine" key={`d${di}`}>
                <td colSpan={totalColspan}>{dom.nom}</td>
              </tr>
              {dom.courses.map((c, ci) => (
                <tr key={`d${di}c${ci}`}>
                  <td className="b-branche">{c.sous_domaine ? <span style={{ color: '#555' }}>{c.sous_domaine} · </span> : null}{c.nom}</td>
                  {c.perPeriode.map((pp, pi) => (
                    <>
                      <td key={pi + 'a'}>{fmt(pp.tj1)}</td>
                      <td key={pi + 'b'}>{fmt(pp.tj2)}</td>
                      <td key={pi + 'c'}>{fmt(pp.exam)}</td>
                      <td key={pi + 'd'}><b>{fmt(pp.total)}</b></td>
                    </>
                  ))}
                  <td><b>{fmt(c.annuel)}</b></td>
                  <td>{c.annuelMax}</td>
                </tr>
              ))}
              <tr className="b-sous" key={`d${di}s`}>
                <td className="b-branche">Sous-total {dom.nom}</td>
                {dom.sous.perPeriode.map((tot, pi) => (
                  <>
                    <td key={pi + 'a'}></td>
                    <td key={pi + 'b'}></td>
                    <td key={pi + 'c'}></td>
                    <td key={pi + 'd'}>{fmt(tot)}</td>
                  </>
                ))}
                <td>{fmt(dom.sous.annuel)}</td>
                <td>{dom.sous.max}</td>
              </tr>
            </>
          ))}
          <tr className="b-gen">
            <td className="b-branche">MAXIMA GÉNÉRAUX</td>
            {totals.perPeriode.map((tot, pi) => (
              <>
                <td key={pi + 'a'}></td>
                <td key={pi + 'b'}></td>
                <td key={pi + 'c'}></td>
                <td key={pi + 'd'}>{fmt(tot)}</td>
              </>
            ))}
            <td>{fmt(totals.annuel)}</td>
            <td>{totals.max}</td>
          </tr>
        </tbody>
      </table>

      <div className="b-foot">
        <div className="b-col">
          <table>
            <tbody>
              <tr><td><b>Total obtenu</b></td><td>{fmt(totals.annuel)} / {totals.max}</td></tr>
              <tr><td><b>Pourcentage</b></td><td>{pourcentage == null ? '' : pourcentage.toFixed(1) + ' %'}</td></tr>
              <tr><td><b>Place</b></td><td>{place ? `${place}${nbreEleves ? ' / ' + nbreEleves : ''}` : ''}</td></tr>
              <tr><td><b>Application</b></td><td>{v(appreciation?.application)}</td></tr>
              <tr><td><b>Conduite</b></td><td>{v(appreciation?.conduite)}</td></tr>
            </tbody>
          </table>
          {system === 'semestre' && (
            <div className="b-deliber">
              Décision : {appreciation?.deliberation === 'passe' ? 'PASSE dans la classe supérieure'
                : appreciation?.deliberation === 'double' ? 'DOUBLE la classe'
                : appreciation?.deliberation === 'repechage' ? 'Admis au REPÊCHAGE' : '…………………………'}
            </div>
          )}
        </div>
        <div className="b-col">
          <div className="b-sign">Signature du Titulaire</div>
          <div className="b-sign" style={{ marginTop: 6 }}>Sceau de l'École &nbsp; — &nbsp; Le Chef d'Établissement</div>
          <div className="b-sign" style={{ marginTop: 6 }}>Signature du Parent / Responsable</div>
        </div>
      </div>
    </div>
  );
}
