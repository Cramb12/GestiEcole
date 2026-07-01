// Small hook to load the single école record (name, school year, logo…).
// Cached (read-through) so the school year is available offline, including on a
// cold start, since it stamps every offline entry.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { readThrough } from './cache.js';

export function useEcole() {
  const [ecole, setEcole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await readThrough('ecole', async () => {
        const r = await supabase.from('ecole').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (r.error) throw r.error;
        return r.data;
      });
      setEcole(data);
      setLoading(false);
    })();
  }, []);

  return { ecole, loading, setEcole };
}
