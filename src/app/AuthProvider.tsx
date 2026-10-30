import { useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let authStateVersion = 0;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authStateVersion += 1;
      setSession(nextSession);
      setIsRecovery(event === 'PASSWORD_RECOVERY');
      setIsLoading(false);
    });

    const initialAuthStateVersion = authStateVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted || authStateVersion !== initialAuthStateVersion) {
        return;
      }

      if (error) {
        toast.error(copy.authSessionError, { description: error.message });
      }

      setSession(data.session);
      setIsLoading(false);
    }).catch((error: unknown) => {
      if (isMounted) {
        toast.error(copy.authSessionError, {
          description: error instanceof Error ? error.message : String(error),
        });
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isRecovery,
        setRecoveryMode: setIsRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
