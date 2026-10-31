import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, Plus, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';

export interface AppShellContext {
  activeHouseholdId: string;
  households: Array<{ id: string; name: string }>;
  householdsReady: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  changeHousehold: (value: string) => void;
  itemDraft: ItemDraft;
  updateItemDraft: (patch: Partial<ItemDraft>) => void;
}

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const addressedInvitesQuery = useQuery({
    queryKey: ['addressed-invites', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_invites');
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

  const changeHousehold = useCallback((value: string) => {
    setSelectedHouseholdId(value);
    try {
      persistHouseholdSelection(value);
    } catch (error) {
      toast.error(copy.householdPreferenceWriteError, { description: errorMessage(error) });
    }
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(copy.signOutError, { description: errorMessage(error) });
      return;
    }
    navigate('/login', { replace: true });
  }

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

  const avatarLabel = user?.email?.slice(0, 1).toUpperCase() ?? 'U';
  const outletContext: AppShellContext = {
    activeHouseholdId,
    households: householdsQuery.data ?? [],
    householdsReady: householdsQuery.isSuccess,
    searchTerm,
    setSearchTerm,
    changeHousehold,
    itemDraft,
    updateItemDraft,
  };

  return (
    <div className="app-shell">
      <aside className="app-rail" aria-label={copy.primaryNavigation}>
        <Link className="app-brand" to="/" aria-label={copy.appName}>{copy.appName}</Link>
        <ButtonPrimaryLink />
        <nav className="app-rail-nav">
          <WarrantiesNavLink />
          <ShellNavLink to="/household" label={copy.family} icon={<Users aria-hidden="true" />} />
          <ShellNavLink to="/settings" label={copy.settings} icon={<Settings aria-hidden="true" />} />
        </nav>
        <div className="app-rail-footer">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="app-account-trigger" type="button">
                <Avatar><AvatarFallback>{avatarLabel}</AvatarFallback></Avatar>
                <span><strong>{displayName(user, profileQuery.data?.display_name)}</strong><small>{user?.email}</small></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{copy.signedInAs}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/settings')}>{copy.settings}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>{copy.signOut}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <WarrantiesNavLink />
        <ShellNavLink to="/household" label={copy.family} icon={<Users aria-hidden="true" />} />
        <ShellNavLink to="/settings" label={copy.settings} icon={<Settings aria-hidden="true" />} />
      </nav>
      <Link className="app-mobile-add" to="/items/new" aria-label={copy.addWarranty}>
        <Plus aria-hidden="true" />
      </Link>
    </div>
  );
}

function ButtonPrimaryLink() {
  return (
    <Button asChild className="app-rail-add">
      <Link to="/items/new"><Plus aria-hidden="true" />{copy.addWarranty}</Link>
    </Button>
  );
}

function displayName(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
  profileName?: string | null,
) {
  const profile = profileName?.trim();
  if (profile) return profile;
  const metadataName = [user?.user_metadata?.display_name, user?.user_metadata?.full_name, user?.user_metadata?.name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (metadataName) return metadataName.trim();
  return user?.email?.split('@')[0] || copy.account;
}

function WarrantiesNavLink() {
  const isHome = Boolean(useMatch({ path: '/', end: true }));
  const isItem = Boolean(useMatch('/items/*'));
  const isNewItem = Boolean(useMatch('/items/new'));
  const isActive = isHome || (isItem && !isNewItem);
  return (
    <NavLink
      className={`shell-nav-link${isActive ? ' is-active' : ''}`}
      to="/"
      end={false}
    >
      <Archive aria-hidden="true" />
      <span>{copy.warranties}</span>
    </NavLink>
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
