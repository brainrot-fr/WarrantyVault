import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, House, Plus, Search, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/app/auth-context';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';

const householdStorageKey = 'warrantyvault-household';
const allHouseholdsValue = 'all';

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(() => {
    try {
      return window.localStorage.getItem(householdStorageKey) ?? allHouseholdsValue;
    } catch (error) {
      console.error(copy.householdPreferenceReadError, error);
      return allHouseholdsValue;
    }
  });
  const householdsQuery = useQuery({
    queryKey: ['households', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('id, name')
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      return data;
    },
  });

  useEffect(() => {
    if (householdsQuery.isError) {
      toast.error(copy.householdsLoadError, {
        description: householdsQuery.error instanceof Error
          ? householdsQuery.error.message
          : String(householdsQuery.error),
      });
    }
  }, [householdsQuery.error, householdsQuery.isError]);

  const isSelectedHouseholdAvailable = selectedHouseholdId === allHouseholdsValue
    || !householdsQuery.data
    || householdsQuery.data.some((household) => household.id === selectedHouseholdId);
  const activeHouseholdId = isSelectedHouseholdAvailable
    ? selectedHouseholdId
    : allHouseholdsValue;

  useEffect(() => {
    if (!isSelectedHouseholdAvailable && selectedHouseholdId !== allHouseholdsValue) {
      try {
        window.localStorage.removeItem(householdStorageKey);
      } catch (error) {
        toast.error(copy.householdPreferenceWriteError, {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [isSelectedHouseholdAvailable, selectedHouseholdId]);

  function changeHousehold(value: string) {
    setSelectedHouseholdId(value);
    try {
      if (value === allHouseholdsValue) {
        window.localStorage.removeItem(householdStorageKey);
      } else {
        window.localStorage.setItem(householdStorageKey, value);
      }
    } catch (error) {
      toast.error(copy.householdPreferenceWriteError, {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const householdName = householdsQuery.data?.find(
    (household) => household.id === activeHouseholdId,
  )?.name;
  const avatarLabel = user?.email?.slice(0, 1).toUpperCase() ?? 'U';

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link className="app-brand" to="/" aria-label={copy.appName}>{copy.appName}</Link>
        <div className="app-topbar-controls">
          <Select value={activeHouseholdId} onValueChange={changeHousehold}>
            <SelectTrigger className="household-switcher" aria-label={copy.selectHouseholdLabel}>
              <House aria-hidden="true" />
              <SelectValue placeholder={copy.allHouseholds}>
                {activeHouseholdId === allHouseholdsValue ? copy.allHouseholds : householdName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allHouseholdsValue}>{copy.allHouseholds}</SelectItem>
              {householdsQuery.data?.map((household) => (
                <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
              ))}
              {householdsQuery.isLoading && (
                <SelectItem value="loading" disabled>{copy.householdsLoading}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="app-search-wrap">
            <Search aria-hidden="true" />
            <Input aria-label={copy.searchItems} placeholder={copy.searchPlaceholder} disabled />
          </div>
          <NavLink className="account-link" to="/settings" aria-label={copy.openSettings}>
            <Avatar>
              <AvatarFallback>{avatarLabel}</AvatarFallback>
            </Avatar>
          </NavLink>
        </div>
      </header>

      <aside className="app-rail" aria-label={copy.primaryNavigation}>
        <nav className="app-rail-nav">
          <ShellNavLink to="/" label={copy.drawer} icon={<Archive aria-hidden="true" />} end />
          <ShellNavLink to="/items/new" label={copy.addItem} icon={<Plus aria-hidden="true" />} />
          <ShellNavLink to="/household" label={copy.household} icon={<Users aria-hidden="true" />} />
        </nav>
        <div className="app-rail-footer">
          <ShellNavLink to="/settings" label={copy.settings} icon={<Settings aria-hidden="true" />} />
          <p className="app-user-email">{user?.email}</p>
        </div>
      </aside>

      <main className="app-content" key={location.pathname}>
        <Outlet />
      </main>

      <nav className="app-bottom-nav" aria-label={copy.primaryNavigation}>
        <ShellNavLink to="/" label={copy.drawer} icon={<Archive aria-hidden="true" />} end />
        <ShellNavLink to="/items/new" label={copy.addItem} icon={<Plus aria-hidden="true" />} />
        <ShellNavLink to="/household" label={copy.household} icon={<Users aria-hidden="true" />} />
      </nav>
    </div>
  );
}

interface ShellNavLinkProps {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

function ShellNavLink({ to, label, icon, end = false }: ShellNavLinkProps) {
  return (
    <NavLink
      className={({ isActive }) => `shell-nav-link${isActive ? ' is-active' : ''}`}
      to={to}
      end={end}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function DrawerHome() {
  const { user } = useAuth();

  return (
    <section className="app-placeholder">
      <p className="app-section-label">{copy.drawer}</p>
      <h1>{copy.drawerWelcome}</h1>
      <p>{copy.drawerComingSoon}</p>
      <p className="app-account-line">{copy.signedInAs} {user?.email}</p>
      <Button asChild>
        <Link to="/items/new">{copy.addFirstItem}</Link>
      </Button>
    </section>
  );
}

export function ShellPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="app-placeholder">
      <p className="app-section-label">{copy.appName}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
