import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/auth-context';
import { useTheme } from '@/app/theme-context';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.user_metadata.display_name;

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(copy.signOutError, {
        description: errorMessage(error),
      });
    }
  }

  return (
    <section className="app-placeholder">
      <p className="app-section-label">{copy.settings}</p>
      <h1>{copy.settingsTitle}</h1>
      <p>{copy.emailAddress}: {user?.email}</p>
      <p>{copy.displayName}: {typeof displayName === 'string' ? displayName : copy.notSet}</p>
      <div className="settings-theme">
        <p>{copy.themePreference}</p>
        <div className="settings-theme-options" role="group" aria-label={copy.themePreference}>
          <ThemeButton theme="system" label={copy.systemTheme} />
          <ThemeButton theme="light" label={copy.lightTheme} />
          <ThemeButton theme="dark" label={copy.darkTheme} />
        </div>
      </div>
      <Button variant="outline" type="button" onClick={() => void signOut()}>{copy.signOut}</Button>
    </section>
  );
}

function ThemeButton({ theme, label }: { theme: 'system' | 'light' | 'dark'; label: string }) {
  const { theme: selectedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant={selectedTheme === theme ? 'secondary' : 'outline'}
      aria-pressed={selectedTheme === theme}
      onClick={() => setTheme(theme)}
    >
      {label}
    </Button>
  );
}
