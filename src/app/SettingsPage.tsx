import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/app/auth-context';
import { useTheme } from '@/app/theme-context';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name, email_reminders').eq('id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(copy.signOutError, { description: errorMessage(error) });
    }
  }

  return (
    <section className="page settings-page">
      <header className="page-header">
        <h1>{copy.settingsTitle}</h1>
        <p>{copy.emailAddress}: {user?.email}</p>
      </header>
      {profileQuery.data && <ProfileSettings userId={user!.id} profile={profileQuery.data} />}
      <section className="settings-section">
        <h2>{copy.appearance}</h2>
        <div className="settings-theme-options" role="group" aria-label={copy.themePreference}>
          <ThemeButton theme="system" label={copy.systemTheme} />
          <ThemeButton theme="light" label={copy.lightTheme} />
          <ThemeButton theme="dark" label={copy.darkTheme} />
        </div>
      </section>
      <section className="settings-section">
        <h2>{copy.account}</h2>
        <Button variant="outline" type="button" onClick={() => void signOut()}>{copy.signOut}</Button>
      </section>
    </section>
  );
}

function ProfileSettings({ userId, profile }: {
  userId: string;
  profile: { display_name: string | null; email_reminders: boolean };
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [emailReminders, setEmailReminders] = useState(profile.email_reminders);

  async function updateProfile(field: 'display_name' | 'email_reminders', value: string | boolean) {
    const previous = field === 'display_name' ? displayName : emailReminders;
    if (field === 'display_name') setDisplayName(String(value));
    else setEmailReminders(Boolean(value));
    try {
      const { error } = field === 'display_name'
        ? await supabase.from('profiles').update({ display_name: String(value) }).eq('id', userId)
        : await supabase.from('profiles').update({ email_reminders: Boolean(value) }).eq('id', userId);
      if (error) throw error;
      toast.success(copy.settingsSaved);
    } catch (error) {
      if (field === 'display_name') setDisplayName(String(previous));
      else setEmailReminders(Boolean(previous));
      toast.error(copy.settingsSaveError, { description: errorMessage(error) });
    }
  }

  return (
    <>
      <section className="settings-section">
        <h2>{copy.profile}</h2>
        <label htmlFor="settings-display-name">{copy.displayName}</label>
        <div className="settings-inline-action">
          <Input id="settings-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Button type="button" onClick={() => void updateProfile('display_name', displayName)}>{copy.save}</Button>
        </div>
      </section>
      <section className="settings-section">
        <h2>{copy.notifications}</h2>
        <label className="settings-switch-row" htmlFor="email-reminders">
          <span>{copy.emailReminders}</span>
          <Switch id="email-reminders" checked={emailReminders} onCheckedChange={(checked) => void updateProfile('email_reminders', checked)} />
        </label>
      </section>
    </>
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
