import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { TooltipProvider } from '@/components/ui/tooltip';
import { copy } from '@/lib/copy';
import { ThemeContext, type ThemePreference } from './theme-context';
const storageKey = 'warrantyvault-theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function loadThemePreference(): ThemePreference {
  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return isThemePreference(storedTheme) ? storedTheme : 'system';
  } catch (error) {
    console.error('Could not read the saved theme preference.', error);
    return 'system';
  }
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState(loadThemePreference);

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && colorScheme.matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      if (Capacitor.isNativePlatform()) {
        void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch((error: unknown) => {
          toast.error(copy.nativeStatusBarError, {
            description: errorMessage(error),
          });
        });
      }
    };

    applyTheme();
    if (theme !== 'system') {
      return;
    }

    colorScheme.addEventListener('change', applyTheme);
    return () => colorScheme.removeEventListener('change', applyTheme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch (error) {
      toast.error(copy.themePersistenceError, {
        description: errorMessage(error),
      });
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeContext.Provider>
  );
}
