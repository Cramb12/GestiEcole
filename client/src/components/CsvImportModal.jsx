// Reusable CSV import dialog. The parent supplies `onImport(rows)` which
// returns { ok: number, errors: string[] }.
import { useState } from 'react';
import { parseCSV } from '../lib/csv.js';
import Modal from './Modal.jsx';

export default function CsvImportModal({ title, expected, note, onImport, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result));
        if (!parsed.length) setError('Le fichier est vide.');
        setRows(parsed);
      } catch (err) { setError('Fichier illisible : ' + err.message); }
    };
    reader.readAsText(file);
  }

  async function run() {
    setBusy(true); setError(null);
    try {
      const res = await onImport(rows);
      setResult(res);
    } catch (err) { setError(err.message || String(err)); }
    setBusy(false);
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={result
        ? <button className="btn btn-primary" onClick={() => { onDone && onDone(); onClose(); }}>Fermer</button>
        : <>
            <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={run} disabled={!rows || !rows.length || busy}>
              {busy ? 'Importation…' : rows ? `Importer ${rows.length} ligne(s)` : 'Importer'}
            </button>
          </>}
    >
      {error && <div className="alert-error">{error}</div>}
      <p className="admin-sub" style={{ marginTop: 0 }}>Colonnes attendues : <code>{expected}</code>{note ? <><br />{note}</> : null}</p>
      {!result && <input type="file" accept=".csv,text/csv" onChange={handleFile} />}
      {rows && !result && <div className="alert-success" style={{ marginTop: 12 }}>{rows.length} ligne(s) détectée(s), prêtes à importer.</div>}
      {result && (
        <div className={result.errors.length ? 'alert-error' : 'alert-success'}>
          {result.ok} réussite(s).{result.errors.length ? ` ${result.errors.length} erreur(s) :` : ''}
          {result.errors.length > 0 && (
            <ul style={{ margin: '6px 0 0 16px' }}>
              {result.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 12 && <li>… (+{result.errors.length - 12})</li>}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
