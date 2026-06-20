// Small hook to load the single école record (name, school year, logo…).
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useEcole() {
  const [ecole, setEcole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('ecole')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setEcole(data);
        setLoading(false);
      });
  }, []);

  return { ecole, loading, setEcole };
}
