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
import { errorMessage } from '@/lib/errors';

interface InviteWithHousehold {
  id: string;
  household_id: string;
  household_name: string;
  inviter_name: string | null;
  expires_at: string;
}

export function InvitesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = user?.email?.trim().toLowerCase();
  const invitesQuery = useQuery({
    queryKey: ['addressed-invites', normalizedEmail],
    enabled: Boolean(normalizedEmail),
    queryFn: async (): Promise<InviteWithHousehold[]> => {
      const { data, error } = await supabase.rpc('list_my_invites');
      if (error) throw error;
      return data;
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
            description: errorMessage(error),
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
    <section className="page household-page">
      <header className="page-header">
      <h1>{copy.yourInvites}</h1>
      <p>{copy.invitesDescription}</p>
      </header>
      {invitesQuery.isLoading ? (
        <p>{copy.invitesLoading}</p>
      ) : invitesQuery.data?.length ? (
        <div className="household-list">
          {invitesQuery.data.map((invite) => {
            return (
              <article className="household-card invite-card" key={invite.id}>
                <header className="household-card-header">
                  <div>
                    <h2>{invite.household_name}</h2>
                    <p>{copy.invitedToJoin} {invite.household_name}</p>
                  </div>
                  <Badge variant="secondary">{copy.pending}</Badge>
                </header>
                <p className="invite-email">{copy.inviteSentTo} {normalizedEmail}</p>
                <p className="invite-expiry">
                  {copy.inviteExpires}: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(invite.expires_at))}
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
