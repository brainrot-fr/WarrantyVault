import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/auth-context';
import { persistHouseholdSelection } from '@/app/household-selection';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';

interface InviteWithHousehold {
  id: string;
  household_id: string;
  email: string;
  expires_at: string;
  created_at: string;
  household: { name: string };
}

export function InvitesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = user?.email?.trim().toLowerCase();
  const invitesQuery = useQuery({
    queryKey: ['addressed-invites', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async (): Promise<InviteWithHousehold[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('id, household_id, email, expires_at, created_at, household:households(name)')
        .eq('email', normalizedEmail!)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((invite) => ({
        ...invite,
        household: invite.household,
      }));
    },
  });
  const inviteAction = useMutation({
    mutationFn: async ({ inviteId, action }: { inviteId: string; action: 'accept' | 'decline' }) => {
      if (action === 'accept') {
        const { data, error } = await supabase.rpc('accept_invite', { invite_id: inviteId });
        if (error) throw error;
        return data;
      }

      const { error } = await supabase.rpc('decline_invite', { invite_id: inviteId });
      if (error) throw error;
      return null;
    },
    onSuccess: async (householdId, { action }) => {
      if (action === 'accept' && householdId) {
        try {
          persistHouseholdSelection(householdId);
        } catch (error) {
          toast.error(copy.householdPreferenceWriteError, {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }
      toast.success(action === 'accept' ? copy.inviteAccepted : copy.inviteDeclined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['addressed-invites'] }),
        queryClient.invalidateQueries({ queryKey: ['households'] }),
        queryClient.invalidateQueries({ queryKey: ['household-members'] }),
        queryClient.invalidateQueries({ queryKey: ['household-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['household-invites'] }),
      ]);
    },
    onError: (error, { action }) => toast.error(
      action === 'accept' ? copy.inviteAcceptError : copy.inviteDeclineError,
      { description: error.message },
    ),
  });

  useEffect(() => {
    if (invitesQuery.error) {
      toast.error(copy.inviteListError, { description: invitesQuery.error.message });
    }
  }, [invitesQuery.error]);

  return (
    <section className="app-placeholder household-page">
      <p className="app-section-label">{copy.household}</p>
      <h1>{copy.yourInvites}</h1>
      <p>{copy.invitesDescription}</p>
      {invitesQuery.isLoading ? (
        <p>{copy.invitesLoading}</p>
      ) : invitesQuery.data?.length ? (
        <div className="household-list">
          {invitesQuery.data.map((invite) => {
            return (
              <article className="household-card invite-card" key={invite.id}>
                <header className="household-card-header">
                  <div>
                    <h2>{invite.household.name}</h2>
                    <p>{copy.invitedToJoin} {invite.household.name}</p>
                  </div>
                  <Badge variant="secondary">{copy.pending}</Badge>
                </header>
                <p className="invite-email">{copy.inviteSentTo} {invite.email}</p>
                <p className="invite-expiry">
                  {copy.inviteExpires}: {new Date(invite.expires_at).toLocaleDateString()}
                </p>
                <footer className="household-card-footer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={inviteAction.isPending}
                    onClick={() => inviteAction.mutate({ inviteId: invite.id, action: 'decline' })}
                  >
                    {copy.declineInvite}
                  </Button>
                  <Button
                    type="button"
                    disabled={inviteAction.isPending}
                    onClick={() => inviteAction.mutate({ inviteId: invite.id, action: 'accept' })}
                  >
                    {copy.acceptInvite}
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="household-empty-state">
          <p>{copy.noInvites}</p>
          <Button asChild variant="outline"><Link to="/household">{copy.viewHouseholds}</Link></Button>
        </div>
      )}
    </section>
  );
}
