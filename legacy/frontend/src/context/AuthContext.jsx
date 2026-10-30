import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (mounted) setSession(data.session);
      })
      .catch((error) => console.error('Could not load the Supabase session.', error))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      loading,
      configured: Boolean(supabase),
      async signIn(email, password) {
        if (!supabase) throw new Error('Add the Supabase frontend environment variables first.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        if (!supabase) throw new Error('Add the Supabase frontend environment variables first.');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      async signInWithGoogle(redirectPath = '/dashboard') {
        if (!supabase) throw new Error('Add the Supabase frontend environment variables first.');
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}${redirectPath}` },
        });
        if (error) throw error;
      },
      async signOut() {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
