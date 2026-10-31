import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, House, Plus, Search, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/app/auth-context';
import {
  allHouseholdsValue,
  persistHouseholdSelection,
  readHouseholdSelection,
  subscribeToHouseholdSelection,
} from '@/app/household-selection';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';
import { createEmptyItemDraft, type ItemDraft } from '@/features/items/item-draft';
import { errorMessage } from '@/lib/errors';

export interface AppShellContext {
  activeHouseholdId: string;
  households: Array<{ id: string; name: string }>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  itemDraft: ItemDraft;
  updateItemDraft: (patch: Partial<ItemDraft>) => void;
}

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(readHouseholdSelection);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemDraft, setItemDraft] = useState(createEmptyItemDraft);
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
  const normalizedEmail = user?.email?.trim().toLowerCase();
  const addressedInvitesQuery = useQuery({
    queryKey: ['addressed-invites', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('id')
        .eq('email', normalizedEmail!)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => subscribeToHouseholdSelection(setSelectedHouseholdId), []);

  useEffect(() => {
    if (householdsQuery.isError) {
      toast.error(copy.householdsLoadError, {
        description: errorMessage(householdsQuery.error),
      });
    }
  }, [householdsQuery.error, householdsQuery.isError]);

  useEffect(() => {
    if (addressedInvitesQuery.isError) {
      toast.error(copy.inviteListError, {
        description: errorMessage(addressedInvitesQuery.error),
      });
    }
  }, [addressedInvitesQuery.error, addressedInvitesQuery.isError]);

  const isSelectedHouseholdAvailable = selectedHouseholdId === allHouseholdsValue
    || !householdsQuery.data
    || householdsQuery.data.some((household) => household.id === selectedHouseholdId);
  const activeHouseholdId = isSelectedHouseholdAvailable
    ? selectedHouseholdId
    : allHouseholdsValue;

  const updateItemDraft = useCallback((patch: Partial<ItemDraft>) => {
    setItemDraft((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!isSelectedHouseholdAvailable && selectedHouseholdId !== allHouseholdsValue) {
      try {
        persistHouseholdSelection(allHouseholdsValue);
      } catch (error) {
        toast.error(copy.householdPreferenceWriteError, {
          description: errorMessage(error),
        });
      }
    }
  }, [isSelectedHouseholdAvailable, selectedHouseholdId]);

  function changeHousehold(value: string) {
    setSelectedHouseholdId(value);
    try {
      persistHouseholdSelection(value);
    } catch (error) {
      toast.error(copy.householdPreferenceWriteError, {
        description: errorMessage(error),
      });
    }
  }

  const householdName = householdsQuery.data?.find(
    (household) => household.id === activeHouseholdId,
  )?.name;
  const avatarLabel = user?.email?.slice(0, 1).toUpperCase() ?? 'U';
  const outletContext: AppShellContext = {
    activeHouseholdId,
    households: householdsQuery.data ?? [],
    searchTerm,
    setSearchTerm,
    itemDraft,
    updateItemDraft,
  };

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
            <Input
              aria-label={copy.searchItems}
              placeholder={copy.searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
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

      <main className="app-content">
        {(location.pathname === '/' ||
          (location.pathname.startsWith('/items/') && location.pathname !== '/items/new'))
          && addressedInvitesQuery.data
          && addressedInvitesQuery.data.length > 0 && (
            <Link className="pending-invites-banner" to="/invites">
              {copy.pendingInviteBanner(addressedInvitesQuery.data.length)}
            </Link>
          )}
        <Outlet context={outletContext} />
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

export function ShellPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="app-placeholder">
      <p className="app-section-label">{copy.appName}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
