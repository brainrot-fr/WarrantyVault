import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Home, Mail, Plus, Send, Users } from 'lucide-react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassChip } from '../components/ui/GlassChip';
import { GlassInput } from '../components/ui/GlassInput';
import { CardSkeleton, GlassSkeleton } from '../components/ui/GlassSkeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { formatDate, normalizeItems } from '../lib/format';

function roleLabel(role) {
  return role ? `${role[0]}${role.slice(1).toLowerCase()}` : 'Member';
}

export function Household() {
  const [selectedId, setSelectedId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [createdHousehold, setCreatedHousehold] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const householdsQuery = useQuery({
    queryKey: ['households'],
    queryFn: () => api.get('/households'),
  });
  const households = normalizeItems(householdsQuery.data);
  const currentHousehold = useMemo(
    () => households.find((household) => household.id === selectedId) || households[0],
    [households, selectedId],
  );
  const membersQuery = useQuery({
    queryKey: ['households', currentHousehold?.id, 'members'],
    queryFn: () => api.get(`/households/${currentHousehold.id}/members`),
    enabled: Boolean(currentHousehold?.id),
  });
  const members = normalizeItems(membersQuery.data);

  const createMutation = useMutation({
    mutationFn: (name) => api.post('/households', { name }),
    onSuccess: (created) => {
      setCreatedHousehold(created);
      setSelectedId(created.id);
      setHouseholdName('');
      queryClient.invalidateQueries({ queryKey: ['households'] });
      toast('Your household is ready.');
    },
    onError: (error) => toast(error.message, 'error'),
  });
  const inviteMutation = useMutation({
    mutationFn: ({ householdId, email }) => api.post(`/households/${householdId}/invites`, { email }),
    onSuccess: async (result) => {
      const token = result.token || result.inviteToken;
      setInviteLink(result.inviteUrl || (token ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}` : ''));
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['households', currentHousehold?.id, 'members'] });
      toast('Invitation sent. Share the secure link if your invitee needs it.');
    },
    onError: (error) => toast(error.message, 'error'),
  });

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast('Invite link copied.');
    } catch {
      toast('Could not copy the link. Select and copy it instead.', 'error');
    }
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-dot" /> Shared, with care</p>
        <h1>One home, together.</h1>
        <p>Keep everyone in your household in the loop, with one shared view of purchases and warranty dates.</p>
      </div>

      {householdsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      ) : householdsQuery.error ? (
        <GlassCard role="alert" className="border-destructive/strong">
          <p className="font-semibold text-destructive">Households could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{householdsQuery.error.message}</p>
        </GlassCard>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-5">
            <GlassCard>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/tint text-accent"><Home className="h-5 w-5" aria-hidden="true" /></span>
                <div><p className="eyebrow">Your space</p><h2 className="font-heading text-2xl font-semibold">Households</h2></div>
              </div>
              {households.length ? (
                <div className="grid gap-2">
                  {households.map((household) => (
                    <button
                      type="button"
                      key={household.id}
                      onClick={() => { setSelectedId(household.id); setInviteLink(''); }}
                      aria-pressed={currentHousehold?.id === household.id}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${currentHousehold?.id === household.id ? 'border-accent/highlight bg-accent/soft' : 'border-transparent hover:bg-primary/soft'}`}
                    >
                      <span className="min-w-0 truncate font-semibold">{household.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{membersQuery.isSuccess && currentHousehold?.id === household.id ? `${members.length} members` : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">Create a household before you add items or invite people.</p>
              )}
              <form
                className="mt-5 grid gap-3 border-t border-primary/soft pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (householdName.trim()) createMutation.mutate(householdName.trim());
                }}
              >
                <GlassInput label="New household" name="householdName" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="e.g. The Morgan home" required />
                <GlassButton type="submit" loading={createMutation.isPending}><Plus className="h-4 w-4" aria-hidden="true" /> Create household</GlassButton>
              </form>
            </GlassCard>

            {createdHousehold && (
              <GlassCard>
                <p className="flex items-center gap-2 text-sm font-semibold text-status-active">
                  <Check className="h-4 w-4" aria-hidden="true" /> {createdHousehold.name} is ready to use
                </p>
                <Link to="/items/new" className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">Add a shared item</Link>
              </GlassCard>
            )}
          </div>

          {currentHousehold ? (
            <div className="grid gap-5">
              <GlassCard>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/tint text-accent"><Users className="h-5 w-5" aria-hidden="true" /></span>
                    <div>
                      <p className="eyebrow">Household members</p>
                      <h2 className="font-heading text-3xl font-semibold">{currentHousehold.name}</h2>
                    </div>
                  </div>
                  <GlassChip status="active">{members.length} {members.length === 1 ? 'person' : 'people'}</GlassChip>
                </div>

                {membersQuery.isLoading ? (
                  <div className="grid gap-4" aria-label="Loading household members">
                    <GlassSkeleton className="h-12 w-full" />
                    <GlassSkeleton className="h-12 w-full" />
                  </div>
                ) : membersQuery.error ? (
                  <p role="alert" className="text-sm text-destructive">{membersQuery.error.message}</p>
                ) : members.length ? (
                  <ul className="divide-y divide-primary/soft">
                    {members.map((member, index) => {
                      const memberEmail = member.email || member.userEmail;
                      const own = member.userId === user?.id || member.id?.userId === user?.id || memberEmail === user?.email;
                      return (
                        <li key={member.userId || member.id?.userId || member.id || index} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{member.displayName || memberEmail || (own ? user?.email : member.userId || 'Household member')}</p>
                            <p className="truncate text-xs text-muted-foreground">{memberEmail || (own ? 'You' : 'Shared access')}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-primary/soft px-3 py-1 text-xs font-semibold">{roleLabel(member.role || member.membershipRole)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Member details are not available yet.</p>
                )}

                <form
                  className="mt-5 grid gap-3 border-t border-primary/soft pt-5 sm:grid-cols-[1fr_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    inviteMutation.mutate({ householdId: currentHousehold.id, email: inviteEmail.trim() });
                  }}
                >
                  <GlassInput
                    label="Invite by email"
                    name="inviteEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                  <div className="self-end">
                    <GlassButton type="submit" loading={inviteMutation.isPending}><Send className="h-4 w-4" aria-hidden="true" /> Send invite</GlassButton>
                  </div>
                </form>
                {inviteLink && (
                  <div className="mt-4 rounded-xl bg-primary/soft p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-accent" aria-hidden="true" /> Invitation link</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        aria-label="Secure household invitation link"
                        readOnly
                        value={inviteLink}
                        onFocus={(event) => event.target.select()}
                        className="glass-input min-h-10 min-w-0 flex-1 rounded-lg px-3 text-xs"
                      />
                      <GlassButton variant="secondary" className="shrink-0" onClick={copyInvite}><Copy className="h-4 w-4" aria-hidden="true" /> Copy</GlassButton>
                    </div>
                  </div>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Invited people need to sign in with the email address you entered. Shared members can manage items in this household.</p>
              </GlassCard>
              <GlassCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div><h3 className="font-semibold">Add a purchase for everyone</h3><p className="mt-1 text-sm text-muted-foreground">New items are shared with this household.</p></div>
                <GlassButton as={Link} to="/items/new" variant="secondary">Add item</GlassButton>
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <Home className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
                <h2 className="mt-3 font-heading text-2xl font-semibold">Create your first household</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">A household is the shared space for your warranties, documents, and reminders.</p>
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </main>
  );
}
