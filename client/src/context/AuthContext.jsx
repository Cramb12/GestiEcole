// Auth context — backed by Supabase Auth.
// Holds the Supabase session + the application profile (with role).
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, email, nom, postnom, role }
  const [loading, setLoading] = useState(true);

  // Loads the profile row (nom, role…) for a given auth user.
  async function loadProfile(authUser) {
    if (!authUser) {
      setUser(null);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nom, postnom, role')
      .eq('id', authUser.id)
      .maybeSingle();

    setUser({
      id: authUser.id,
      email: authUser.email,
      nom: profile?.nom || authUser.email,
      postnom: profile?.postnom || '',
      role: profile?.role || 'teacher',
    });
  }

  useEffect(() => {
    // Restore any existing session on first load.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await loadProfile(session?.user || null);
      setLoading(false);
    });

    // React to login / logout / token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session?.user || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile(data.user);
    // Return the freshly loaded role so the caller can redirect.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    return { id: data.user.id, role: profile?.role || 'teacher' };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
