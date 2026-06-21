// Renders one student's official-style bulletin (A4 PORTRAIT).
// Matches the MINEDUC layout: per period (1ère P, 2ème P, Examen, Total),
// Total général, Examen de Repêchage (secondary), and the official footer.
const fmt = (x) => (x === null || x === undefined ? '' : Number(x).toFixed(Number.isInteger(Number(x)) ? 0 : 1));
const ord = (n) => (n === 1 ? '1ère' : `${n}ème`);

// DRC flag (sky blue field, yellow-bordered red diagonal, yellow star).
function Flag() {
  return (
    <svg viewBox="0 0 90 60" className="b-flag-svg" preserveAspectRatio="none">
      <rect width="90" height="60" fill="#0086ce" />
      <line x1="0" y1="60" x2="90" y2="0" stroke="#f7d116" strokeWidth="16" />
      <line x1="0" y1="60" x2="90" y2="0" stroke="#ce1021" strokeWidth="10" />
      <polygon points="16,6 17.57,10.84 22.66,10.84 18.54,13.83 20.12,18.66 16,15.67 11.88,18.66 13.46,13.83 9.34,10.84 14.43,10.84" fill="#f7d116" />
    </svg>
  );
}

// A row of small boxes (N° ID, Code, N° Perm), pre-filled from a value.
function Cells({ value = '', count }) {
  const chars = String(value || '').slice(0, count).split('');
  return (
    <span className="b-cells">
      {Array.from({ length: count }).map((_, i) => <span className="b-cell" key={i}>{chars[i] || ''}</span>)}
    </span>
  );
}

// Official title line, built from the level/section/year.
function makeTitle(d) {
  const t = d.template;
  const an = d.classe?.annee;
  const sec = d.classe?.sections?.nom;
  const ordA = an ? `${an === '1' ? '1ère' : an + 'ème'} ANNÉE ` : '';
  if (t === 'humanites') return `BULLETIN DE LA ${ordA}HUMANITÉS${sec ? ' / ' + sec.toUpperCase() : ''}`;
  if (t === 'cteb') return `BULLETIN DE LA ${ordA}CYCLE D'ORIENTATION`;
  const m = { elementaire: "DEGRÉ ÉLÉMENTAIRE (1ère, 2ème ANNÉE)", moyen: "DEGRÉ MOYEN (3ème, 4ème ANNÉE)", terminal: "DEGRÉ TERMINAL (5ème, 6ème ANNÉE)" };
  return `BULLETIN DE L'ÉLÈVE : ${m[t] || ''}`;
}

const ARMS_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Coat_of_arms_of_the_Democratic_Republic_of_the_Congo_%28grey_spear%29.svg/120px-Coat_of_arms_of_the_Democratic_Republic_of_the_Congo_%28grey_spear%29.svg.png';

export default function Bulletin({ data }) {
  if (!data) return null;
  const { ecole, eleve, classe, system, ref, titre, periodes, domaines, totals, pourcentage, place, nbreEleves, appreciation, approuve } = data;

  const sec = system === 'semestre';
  // 7 columns per period: MAX | 1ère P. | 2è P. | MAX.EXAM | EXAM | MAX.TOT | TOTAL
  const perCols = 7;
  // BRANCHES + periods*7 + TOTAL GÉNÉRAL(2) + (repêchage 2 if secondary)
  const colCount = 1 + periodes.length * perCols + 2 + (sec ? 2 : 0);

  const fullName = `${eleve.nom} ${eleve.postnom || ''} ${eleve.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const pLabel = (n) => (n === 1 ? '1ère P.' : `${n}è P.`);
  const subLabels = (numero) => [pLabel(numero * 2 - 1), pLabel(numero * 2)];

  return (
    <div className="bulletin">
      {!approuve && <div className="b-watermark">PROVISOIRE</div>}

      <div className="b-top">
        <div className="b-flag"><Flag /></div>
        <div className="b-titlecenter">
          <div>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</div>
          <div>MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
          <div>ET NOUVELLE CITOYENNETÉ</div>
        </div>
        <div className="b-arms">
          <img src={ARMS_URL} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      </div>

      <div className="b-idrow"><span className="b-idlabel">N° ID.</span><Cells count={26} /></div>

      <div className="b-province"><b>PROVINCE ÉDUCATIONNELLE :</b> {ecole?.province || ''}</div>

      <div className="b-info">
        <div className="b-info-left">
          <div><b>VILLE :</b> {ecole?.ville || ''}</div>
          <div><b>COMMUNE / TER. (1) :</b> {ecole?.commune || ''}</div>
          <div><b>ÉCOLE :</b> {ecole?.nom_ecole || ''}</div>
          <div className="b-line-cells"><b>CODE :</b> <Cells value={ecole?.code_ecole} count={10} /></div>
        </div>
        <div className="b-info-right">
          <div><b>ÉLÈVE :</b> {fullName} &nbsp;&nbsp; <b>SEXE :</b> {eleve.sexe || ''}</div>
          <div><b>NÉ(E) À :</b> {eleve.lieu_naissance || ''} &nbsp; <b>LE</b> {eleve.date_naissance || ''}</div>
          <div><b>CLASSE :</b> {classe?.nom || ''}{classe?.sections ? ' / ' + classe.sections.nom : ''}</div>
          <div className="b-line-cells"><b>N° PERM. :</b> <Cells value={eleve.numero_perm} count={13} /></div>
        </div>
      </div>

      <div className="b-title">{makeTitle(data)} &nbsp; ANNÉE SCOLAIRE {ecole?.annee_scolaire || ''}</div>

      <table className="b-grid">
        <thead>
          <tr>
            <th rowSpan={3} style={{ width: '19%', textAlign: 'left' }}>BRANCHES</th>
            {periodes.map((p) => <th key={p.id} colSpan={perCols}>{p.nom.toUpperCase()}</th>)}
            <th colSpan={2} rowSpan={2}>TOTAL GÉNÉRAL</th>
            {sec && <th colSpan={2}>EXAMEN DE REPÊCHAGE</th>}
          </tr>
          <tr>
            {periodes.map((p) => (
              <>
                <th key={p.id + 'm'} rowSpan={2}>MAX.</th>
                <th key={p.id + 'tj'} colSpan={2}>TRAVAUX JOURNAL.</th>
                <th key={p.id + 'me'} rowSpan={2}>MAX. EXAM.</th>
                <th key={p.id + 'e'} rowSpan={2}>EXAM.</th>
                <th key={p.id + 'mt'} rowSpan={2}>MAX. TOT.</th>
                <th key={p.id + 't'} rowSpan={2}>TOTAL</th>
              </>
            ))}
            {sec && <th rowSpan={2}>%</th>}
            {sec && <th rowSpan={2}>Sign. Prof.</th>}
          </tr>
          <tr>
            {periodes.map((p) => {
              const [a, b] = subLabels(p.numero);
              return (<><th key={p.id + 'a'}>{a}</th><th key={p.id + 'b'}>{b}</th></>);
            })}
            <th>Max.</th>
            <th>Obt.</th>
          </tr>
        </thead>
        <tbody>
          {domaines.map((dom, di) => (
            <>
              <tr className="b-domaine" key={`d${di}`}><td colSpan={colCount}>{dom.nom}</td></tr>
              {dom.courses.map((c, ci) => (
                <tr key={`d${di}c${ci}`}>
                  <td className="b-branche">{c.nom}</td>
                  {c.perPeriode.map((pp, pi) => (
                    <>
                      <td key={pi + 'm'}>{c.M}</td>
                      <td key={pi + '1'}>{fmt(pp.tj1)}</td>
                      <td key={pi + '2'}>{fmt(pp.tj2)}</td>
                      <td key={pi + 'me'}>{c.mx.exam}</td>
                      <td key={pi + 'e'}>{fmt(pp.exam)}</td>
                      <td key={pi + 'mt'}>{c.mx.total}</td>
                      <td key={pi + 't'}><b>{fmt(pp.total)}</b></td>
                    </>
                  ))}
                  <td>{c.annuelMax}</td>
                  <td><b>{fmt(c.annuel)}</b></td>
                  {sec && <td></td>}{sec && <td></td>}
                </tr>
              ))}
              <tr className="b-sous" key={`d${di}s`}>
                <td className="b-branche">SOUS-TOTAL</td>
                {dom.sous.perPeriode.map((agg, pi) => (
                  <>
                    <td key={pi + 'm'}>{dom.sous.M}</td>
                    <td key={pi + '1'}></td>
                    <td key={pi + '2'}></td>
                    <td key={pi + 'me'}>{2 * dom.sous.M}</td>
                    <td key={pi + 'e'}>{fmt(agg.exam)}</td>
                    <td key={pi + 'mt'}>{4 * dom.sous.M}</td>
                    <td key={pi + 't'}><b>{fmt(agg.total)}</b></td>
                  </>
                ))}
                <td>{dom.sous.max}</td>
                <td><b>{fmt(dom.sous.annuel)}</b></td>
                {sec && <td></td>}{sec && <td></td>}
              </tr>
            </>
          ))}

          <tr className="b-gen">
            <td className="b-branche">MAXIMA GÉNÉRAUX</td>
            {totals.perPeriode.map((agg, pi) => (
              <>
                <td key={pi + 'm'}>{totals.M}</td>
                <td key={pi + '1'}></td>
                <td key={pi + '2'}></td>
                <td key={pi + 'me'}>{2 * totals.M}</td>
                <td key={pi + 'e'}>{fmt(agg.exam)}</td>
                <td key={pi + 'mt'}>{4 * totals.M}</td>
                <td key={pi + 't'}><b>{fmt(agg.total)}</b></td>
              </>
            ))}
            <td>{totals.max}</td>
            <td><b>{fmt(totals.annuel)}</b></td>
            {sec && <td></td>}{sec && <td></td>}
          </tr>

          <tr className="b-foot-row">
            <td className="b-branche">POURCENTAGE</td>
            <td colSpan={colCount - 1}><b>{pourcentage == null ? '' : pourcentage.toFixed(1) + ' %'}</b></td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">PLACE / NBRE D'ÉLÈVES</td>
            <td colSpan={colCount - 1}>{place ? `${place} / ${nbreEleves}` : ''}</td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">APPLICATION</td>
            <td colSpan={colCount - 1}>{appreciation?.application || ''}</td>
          </tr>
          <tr className="b-foot-row">
            <td className="b-branche">CONDUITE</td>
            <td colSpan={colCount - 1}>{appreciation?.conduite || ''}</td>
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
