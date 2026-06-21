// Renders one student's official-style bulletin (A4 PORTRAIT).
// Matches the MINEDUC layout: per period (1ère P, 2ème P, Examen, Total),
// Total général, Examen de Repêchage (secondary), and the official footer.
const fmt = (x) => (x === null || x === undefined ? '' : Number(x).toFixed(Number.isInteger(Number(x)) ? 0 : 1));
const ord = (n) => (n === 1 ? '1ère' : `${n}ème`);

export default function Bulletin({ data }) {
  if (!data) return null;
  const { ecole, eleve, classe, system, ref, titre, periodes, domaines, totals, pourcentage, place, nbreEleves, appreciation, approuve } = data;

  const sec = system === 'semestre';
  // Columns per period: subA, subB, Examen, Total.
  const perCols = 4;
  // BRANCHES + Max/p + periods*4 + TOTAL(2) + (repêchage 2 if secondary)
  const colCount = 2 + periodes.length * perCols + 2 + (sec ? 2 : 0);

  const fullName = `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const naissance = [eleve.lieu_naissance, eleve.date_naissance].filter(Boolean).join(' le ');
  const subLabels = (numero) => [`${ord(numero * 2 - 1)} P.`, `${ord(numero * 2)} P.`];

  const emptyPer = () => Array.from({ length: periodes.length * perCols }, (_, i) => <td key={'e' + i}></td>);

  return (
    <div className="bulletin">
      {!approuve && <div className="b-watermark">PROVISOIRE</div>}

      <div className="b-head">
        <div className="b-pays">RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</div>
        <div className="b-min">MINISTÈRE DE L'ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ</div>
      </div>

      <div className="b-meta">
        <div className="b-box">
          <div><b>Province Éducationnelle :</b> {ecole?.province || ''}</div>
          <div><b>Ville :</b> {ecole?.ville || ''}</div>
          <div><b>Commune / Terr. :</b> {ecole?.commune || ''}</div>
          <div><b>École :</b> {ecole?.nom_ecole || ''}</div>
          <div><b>Code :</b> {ecole?.code_ecole || ''}</div>
        </div>
        <div className="b-box">
          <div><b>Élève :</b> {fullName}</div>
          <div><b>Sexe :</b> {eleve.sexe || ''}</div>
          <div><b>Né(e) à :</b> {naissance}</div>
          <div><b>Classe :</b> {classe?.nom || ''}{classe?.sections ? ' / ' + classe.sections.nom : ''}</div>
          <div><b>N° Perm. :</b> {eleve.numero_perm || ''}</div>
        </div>
      </div>

      <div className="b-title">{titre} — ANNÉE SCOLAIRE {ecole?.annee_scolaire || ''}</div>

      <table className="b-grid">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '22%', textAlign: 'left' }}>BRANCHES</th>
            <th rowSpan={2}>Max/p</th>
            {periodes.map((p) => <th key={p.id} colSpan={perCols}>{p.nom}</th>)}
            <th colSpan={2}>TOTAL</th>
            {sec && <th colSpan={2}>EXAMEN DE REPÊCHAGE</th>}
          </tr>
          <tr>
            {periodes.map((p) => {
              const [a, b] = subLabels(p.numero);
              return (
                <>
                  <th key={p.id + '1'}>{a}</th>
                  <th key={p.id + '2'}>{b}</th>
                  <th key={p.id + '3'}>Ex.</th>
                  <th key={p.id + '4'}>Tot.</th>
                </>
              );
            })}
            <th>Max</th>
            <th>Pts</th>
            {sec && <th>%</th>}
            {sec && <th>Sign.</th>}
          </tr>
        </thead>
        <tbody>
          {domaines.map((dom, di) => (
            <>
              <tr className="b-domaine" key={`d${di}`}><td colSpan={colCount}>{dom.nom}</td></tr>
              {dom.courses.map((c, ci) => (
                <tr key={`d${di}c${ci}`}>
                  <td className="b-branche">{c.sous_domaine ? <i style={{ color: '#444' }}>{c.sous_domaine} · </i> : null}{c.nom}</td>
                  <td>{c.M}</td>
                  {c.perPeriode.map((pp, pi) => (
                    <>
                      <td key={pi + 'a'}>{fmt(pp.tj1)}</td>
                      <td key={pi + 'b'}>{fmt(pp.tj2)}</td>
                      <td key={pi + 'c'}>{fmt(pp.exam)}</td>
                      <td key={pi + 'd'}><b>{fmt(pp.total)}</b></td>
                    </>
                  ))}
                  <td>{c.annuelMax}</td>
                  <td><b>{fmt(c.annuel)}</b></td>
                  {sec && <td></td>}
                  {sec && <td></td>}
                </tr>
              ))}
              <tr className="b-sous" key={`d${di}s`}>
                <td className="b-branche">Sous-total</td>
                <td></td>
                {dom.sous.perPeriode.map((tot, pi) => (
                  <>
                    <td key={pi + 'a'}></td><td key={pi + 'b'}></td><td key={pi + 'c'}></td>
                    <td key={pi + 'd'}>{fmt(tot)}</td>
                  </>
                ))}
                <td>{dom.sous.max}</td>
                <td>{fmt(dom.sous.annuel)}</td>
                {sec && <td></td>}{sec && <td></td>}
              </tr>
            </>
          ))}

          <tr className="b-gen">
            <td className="b-branche">MAXIMA GÉNÉRAUX</td>
            <td></td>
            {totals.perPeriode.map((tot, pi) => (
              <>
                <td key={pi + 'a'}></td><td key={pi + 'b'}></td><td key={pi + 'c'}></td>
                <td key={pi + 'd'}>{fmt(tot)}</td>
              </>
            ))}
            <td>{totals.max}</td>
            <td><b>{fmt(totals.annuel)}</b></td>
            {sec && <td></td>}{sec && <td></td>}
          </tr>

          <tr className="b-foot-row">
            <td className="b-branche">POURCENTAGE</td><td></td>
            {emptyPer()}
            <td colSpan={2 + (sec ? 2 : 0)}><b>{pourcentage == null ? '' : pourcentage.toFixed(1) + ' %'}</b></td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">PLACE / NBRE D'ÉLÈVES</td><td></td>
            {emptyPer()}
            <td colSpan={2 + (sec ? 2 : 0)}>{place ? `${place} / ${nbreEleves}` : ''}</td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">APPLICATION</td><td></td>
            {emptyPer()}
            <td colSpan={2 + (sec ? 2 : 0)}>{appreciation?.application || ''}</td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">CONDUITE</td><td></td>
            {emptyPer()}
            <td colSpan={2 + (sec ? 2 : 0)}>{appreciation?.conduite || ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="b-bottom">
        {sec ? (
          <div className="b-decision">
            <div>- L'élève ne pourra passer dans la classe supérieure s'il n'a subi avec succès un examen de repêchage en ……………………</div>
            <div>- L'élève passe dans la classe supérieure (1) &nbsp;&nbsp; - L'élève double la classe (1)</div>
            <div style={{ marginTop: 4 }}><b>Décision :</b> {appreciation?.deliberation === 'passe' ? 'PASSE' : appreciation?.deliberation === 'double' ? 'DOUBLE' : appreciation?.deliberation === 'repechage' ? 'REPÊCHAGE' : '……………'}</div>
          </div>
        ) : (
          <div className="b-decision">
            <div>- L'élève passe dans la classe supérieure (1)</div>
            <div>- L'élève double la classe (1)</div>
          </div>
        )}
        <div className="b-signs">
          <div className="b-sign-box">Signature de l'élève</div>
          <div className="b-sign-box">Sceau de l'École</div>
          <div className="b-sign-box">Le Chef d'Établissement<br />(Noms et Signature)</div>
        </div>
      </div>

      <div className="b-ref">Réf. {ref} — (1) Biffer la mention inutile. Le bulletin est sans valeur s'il est raturé ou surchargé.</div>
    </div>
  );
}
