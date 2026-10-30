import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { nativeAuthStorage } from './native-storage';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    ...(Capacitor.isNativePlatform() ? { storage: nativeAuthStorage } : {}),
  },
});
