// Local autosave for in-progress data entry (offline resilience — Étape 0).
// Anything typed (grades, attendance) is mirrored to localStorage so a refresh,
// a crash, or a dropped connection never loses the teacher's work. Drafts are
// cleared once the data is successfully saved to the server.
const NS = 'gestiecole:draft:';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // auto-expire after 7 days

export function saveDraft(key, data) {
  try { localStorage.setItem(NS + key, JSON.stringify({ t: Date.now(), data })); }
  catch { /* quota exceeded / private mode — ignore */ }
}

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > MAX_AGE) { localStorage.removeItem(NS + key); return null; }
    return data;
  } catch { return null; }
}

export function clearDraft(key) {
  try { localStorage.removeItem(NS + key); } catch { /* ignore */ }
}
