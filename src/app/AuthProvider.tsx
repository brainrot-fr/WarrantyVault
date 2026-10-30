import { useEffect, useState, type PropsWithChildren } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { copy } from '@/lib/copy';
import { parseNativeAuthRedirect } from '@/lib/native-config';
import { supabase } from '@/lib/supabase/client';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;
    const processedUrls = new Set<string>();
    let urlListener: { remove: () => Promise<void> } | undefined;

    async function handleUrl(url: string) {
      if (processedUrls.has(url)) return;
      const callback = parseNativeAuthRedirect(url);
      if (!callback) return;
      processedUrls.add(url);

      try {
        if (callback.error) throw new Error(callback.error);
        if (!callback.code) throw new Error(copy.nativeAuthCodeMissing);
        const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error) throw error;
        if (callback.isPasswordRecovery) setIsRecovery(true);
        navigate(callback.isPasswordRecovery ? '/auth/reset' : callback.returnTo, { replace: true });
        await Browser.close().catch((error: unknown) => {
          console.warn('The native auth browser could not be closed.', error);
        });
      } catch (error) {
        toast.error(copy.nativeAuthError, {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void handleUrl(url);
    }).then((listener) => {
      if (isMounted) urlListener = listener;
      else void listener.remove();
    }).catch((error: unknown) => {
      toast.error(copy.nativeAuthError, {
        description: error instanceof Error ? error.message : String(error),
      });
    });

    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (isMounted && launch?.url) return handleUrl(launch.url);
      return undefined;
    }).catch((error: unknown) => {
      toast.error(copy.nativeAuthError, {
        description: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      isMounted = false;
      if (urlListener) void urlListener.remove();
    };
  }, [navigate]);

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
