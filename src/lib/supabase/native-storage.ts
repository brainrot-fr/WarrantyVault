import { Preferences } from '@capacitor/preferences';
import type { SupportedStorage } from '@supabase/supabase-js';

export const nativeAuthStorage: SupportedStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => Preferences.set({ key, value }),
  removeItem: async (key) => Preferences.remove({ key }),
};
