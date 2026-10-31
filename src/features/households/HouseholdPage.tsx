import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { invoke } from '@/lib/supabase/invoke';
import { errorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/app/auth-context';
import { persistHouseholdSelection } from '@/app/household-selection';
import { copy } from '@/lib/copy';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/types';
import { createHouseholdSchema, inviteMemberSchema, type CreateHouseholdValues, type InviteMemberValues } from './household-schemas';

type Household = Pick<Tables<'households'>, 'id' | 'name' | 'created_at'>;
type Membership = Pick<Tables<'household_members'>, 'household_id' | 'user_id' | 'role' | 'joined_at'>;
type Profile = Pick<Tables<'profiles'>, 'id' | 'email' | 'display_name'>;
type Invite = Pick<Tables<'household_invites'>, 'id' | 'household_id' | 'email' | 'invited_by' | 'expires_at' | 'created_at'>;

type PendingAction =
  | { kind: 'remove-member'; householdId: string; userId: string; label: string }
  | { kind: 'leave-household'; householdId: string; label: string }
  | { kind: 'delete-household'; householdId: string; label: string };

export function HouseholdPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const createForm = useForm<CreateHouseholdValues>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: '' },
  });
  const householdsQuery = useQuery({
    queryKey: ['households', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Household[]> => {
      const { data, error } = await supabase
        .from('households')
        .select('id, name, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const householdIds = householdsQuery.data?.map(({ id }) => id) ?? [];
  const membershipsQuery = useQuery({
    queryKey: ['household-members', user?.id, householdIds],
    enabled: householdIds.length > 0,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, user_id, role, joined_at')
        .in('household_id', householdIds)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const memberIds = [...new Set(membershipsQuery.data?.map(({ user_id }) => user_id) ?? [])];
  const profilesQuery = useQuery({
    queryKey: ['household-profiles', memberIds],
    enabled: memberIds.length > 0,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', memberIds);
      if (error) throw error;
      return data;
    },
  });
  const invitesQuery = useQuery({
    queryKey: ['household-invites', user?.id, householdIds],
    enabled: householdIds.length > 0,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('id, household_id, email, invited_by, expires_at, created_at')
        .in('household_id', householdIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const createHousehold = useMutation({
    mutationFn: async ({ name }: CreateHouseholdValues) => {
      const { data, error } = await supabase.rpc('create_household', { name });
      if (error) throw error;
      return data;
    },
    onSuccess: async (householdId) => {
      createForm.reset();
      try {
        persistHouseholdSelection(householdId);
      } catch (error) {
        toast.error(copy.householdPreferenceWriteError, {
          description: errorMessage(error),
        });
      }
      toast.success(copy.householdCreated);
      await queryClient.invalidateQueries({ queryKey: ['households', user?.id] });
    },
    onError: (error) => toast.error(copy.householdCreateError, { description: error.message }),
  });
  const manageHousehold = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (action.kind === 'remove-member') {
        const { error } = await supabase.rpc('remove_member', {
          household_id: action.householdId,
          user_id: action.userId,
        });
        if (error) throw error;
      } else if (action.kind === 'leave-household') {
        const { error } = await supabase.rpc('leave_household', {
          household_id: action.householdId,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('households')
          .delete()
          .eq('id', action.householdId)
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error(copy.householdDeleteMissing);
      }
    },
    onSuccess: async (_data, action) => {
      setPendingAction(null);
      if (action.kind !== 'remove-member') {
        try {
          persistHouseholdSelection('all');
        } catch (error) {
          toast.error(copy.householdPreferenceWriteError, {
            description: errorMessage(error),
          });
        }
      }
      toast.success(
        action.kind === 'remove-member'
          ? copy.memberRemoved
          : action.kind === 'leave-household'
            ? copy.householdLeft
            : copy.householdDeleted,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['households'] }),
        queryClient.invalidateQueries({ queryKey: ['household-members'] }),
        queryClient.invalidateQueries({ queryKey: ['household-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['household-invites'] }),
      ]);
    },
    onError: (error) => toast.error(copy.householdActionError, { description: error.message }),
  });
  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('household_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('status', 'pending')
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(copy.inviteRevoked);
      await queryClient.invalidateQueries({ queryKey: ['household-invites'] });
    },
    onError: (error) => toast.error(copy.inviteRevokeError, { description: error.message }),
  });
  const resendInvite = useMutation({
    mutationFn: async (invite: Pick<Invite, 'household_id' | 'email'>) => {
      await invoke('invite-member', { household_id: invite.household_id, email: invite.email });
    },
    onSuccess: async () => {
      toast.success(copy.inviteResent);
      await queryClient.invalidateQueries({ queryKey: ['household-invites'] });
    },
    onError: (error) => toast.error(copy.inviteResendError, { description: error.message }),
  });

  useEffect(() => {
    const errors = [
      householdsQuery.error,
      membershipsQuery.error,
      profilesQuery.error,
      invitesQuery.error,
    ].filter((error): error is Error => error instanceof Error);
    if (errors.length > 0) {
      toast.error(copy.householdDataLoadError, { description: errors[0].message });
    }
  }, [
    householdsQuery.error,
    membershipsQuery.error,
    profilesQuery.error,
    invitesQuery.error,
  ]);

  const profilesById = useMemo(
    () => new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile])),
    [profilesQuery.data],
  );
  const membershipsByHousehold = useMemo(() => {
    const result = new Map<string, Membership[]>();
    for (const membership of membershipsQuery.data ?? []) {
      const group = result.get(membership.household_id) ?? [];
      group.push(membership);
      result.set(membership.household_id, group);
    }
    return result;
  }, [membershipsQuery.data]);
  const invitesByHousehold = useMemo(() => {
    const result = new Map<string, Invite[]>();
    for (const invite of invitesQuery.data ?? []) {
      const group = result.get(invite.household_id) ?? [];
      group.push(invite);
      result.set(invite.household_id, group);
    }
    return result;
  }, [invitesQuery.data]);

  function submitCreate(values: CreateHouseholdValues) {
    createHousehold.mutate(values);
  }

  function confirmPendingAction() {
    if (pendingAction) {
      manageHousehold.mutate(pendingAction);
    }
  }

  return (
    <section className="app-placeholder household-page">
      <p className="app-section-label">{copy.household}</p>
      <h1>{copy.householdsTitle}</h1>
      <p>{copy.householdsDescription}</p>
      <Link className="auth-inline-link" to="/invites">{copy.viewMyInvites}</Link>

      <form className="household-create-form" onSubmit={createForm.handleSubmit(submitCreate)} noValidate>
        <Label htmlFor="household-name">{copy.householdName}</Label>
        <div className="household-create-fields">
          <Input
            id="household-name"
            autoComplete="organization"
            aria-invalid={Boolean(createForm.formState.errors.name)}
            aria-describedby={createForm.formState.errors.name ? 'household-name-error' : undefined}
            {...createForm.register('name')}
          />
          <Button type="submit" disabled={createHousehold.isPending}>
            {createHousehold.isPending ? copy.working : copy.createHousehold}
          </Button>
        </div>
        {createForm.formState.errors.name && (
          <p id="household-name-error" className="auth-field-error">
            {createForm.formState.errors.name.message}
          </p>
        )}
      </form>

      {householdsQuery.isLoading ? (
        <p>{copy.householdsLoading}</p>
      ) : householdsQuery.data?.length ? (
        <div className="household-list">
          {householdsQuery.data.map((household) => {
            const memberships = membershipsByHousehold.get(household.id) ?? [];
            const currentMembership = memberships.find(({ user_id }) => user_id === user?.id);
            const isOwner = currentMembership?.role === 'owner';
            const householdInvites = invitesByHousehold.get(household.id) ?? [];
            return (
              <article className="household-card" key={household.id}>
                <header className="household-card-header">
                  <div>
                    <h2>{household.name}</h2>
                    <p>{memberships.length} {memberships.length === 1 ? copy.member : copy.members}</p>
                  </div>
                  <Badge variant={isOwner ? 'secondary' : 'outline'}>
                    {isOwner ? copy.ownerRole : copy.memberRole}
                  </Badge>
                </header>

                <Separator />
                <section className="household-section" aria-labelledby={`members-${household.id}`}>
                  <h3 id={`members-${household.id}`}>{copy.membersTitle}</h3>
                  <ul className="household-people">
                    {memberships.map((membership) => {
                      const profile = profilesById.get(membership.user_id);
                      const personLabel = profile?.display_name || profile?.email || copy.householdMember;
                      return (
                        <li key={membership.user_id}>
                          <div>
                            <strong>{personLabel}</strong>
                            {profile?.display_name && <span>{profile.email}</span>}
                          </div>
                          <div className="household-person-actions">
                            <Badge variant={membership.role === 'owner' ? 'secondary' : 'outline'}>
                              {membership.role === 'owner' ? copy.ownerRole : copy.memberRole}
                            </Badge>
                            {isOwner && membership.role === 'member' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPendingAction({
                                  kind: 'remove-member',
                                  householdId: household.id,
                                  userId: membership.user_id,
                                  label: personLabel,
                                })}
                              >
                                {copy.removeMember}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <Separator />
                <InviteMemberForm householdId={household.id} householdName={household.name} />

                <section className="household-section" aria-labelledby={`pending-${household.id}`}>
                  <h3 id={`pending-${household.id}`}>{copy.pendingInvites}</h3>
                  {householdInvites.length ? (
                    <ul className="household-people">
                      {householdInvites.map((invite) => (
                        <li key={invite.id}>
                          <div>
                            <strong>{invite.email}</strong>
                            <span>{copy.inviteExpires}: {new Date(invite.expires_at).toLocaleDateString()}</span>
                          </div>
                          <div className="household-person-actions">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={resendInvite.isPending}
                              onClick={() => resendInvite.mutate(invite)}
                            >
                              {copy.resendInvite}
                            </Button>
                            {isOwner && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={revokeInvite.isPending}
                                onClick={() => revokeInvite.mutate(invite.id)}
                              >
                                {copy.revokeInvite}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p>{copy.noPendingInvites}</p>}
                </section>

                <Separator />
                <footer className="household-card-footer">
                  {isOwner ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingAction({
                        kind: 'delete-household',
                        householdId: household.id,
                        label: household.name,
                      })}
                    >
                      {copy.deleteHousehold}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingAction({
                        kind: 'leave-household',
                        householdId: household.id,
                        label: household.name,
                      })}
                    >
                      {copy.leaveHousehold}
                    </Button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="household-empty-state">{copy.noHouseholds}</p>
      )}

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !manageHousehold.isPending) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getActionTitle(pendingAction?.kind)}</AlertDialogTitle>
            <AlertDialogDescription>
              {getActionDescription(pendingAction)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={manageHousehold.isPending}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.kind === 'delete-household' ? 'destructive' : 'default'}
              disabled={manageHousehold.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmPendingAction();
              }}
            >
              {manageHousehold.isPending ? copy.working : getActionConfirmLabel(pendingAction?.kind)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InviteMemberForm({ householdId, householdName }: { householdId: string; householdName: string }) {
  const queryClient = useQueryClient();
  const form = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  });
  const inviteMember = useMutation({
    mutationFn: async ({ email }: InviteMemberValues) => {
      await invoke('invite-member', { household_id: householdId, email });
    },
    onSuccess: async () => {
      form.reset();
      toast.success(copy.inviteSent);
      await queryClient.invalidateQueries({ queryKey: ['household-invites'] });
    },
    onError: (error) => toast.error(copy.inviteSendError, { description: error.message }),
  });

  return (
    <form
      className="household-invite-form"
      onSubmit={form.handleSubmit((values) => inviteMember.mutate(values))}
      noValidate
    >
      <Label htmlFor={`invite-${householdId}`}>{copy.inviteEmailLabel} {householdName}</Label>
      <div className="household-create-fields">
        <Input
          id={`invite-${householdId}`}
          type="email"
          autoComplete="email"
          placeholder={copy.emailAddress}
          aria-invalid={Boolean(form.formState.errors.email)}
          aria-describedby={form.formState.errors.email ? `invite-error-${householdId}` : undefined}
          {...form.register('email')}
        />
        <Button type="submit" disabled={inviteMember.isPending}>
          {inviteMember.isPending ? copy.working : copy.inviteMember}
        </Button>
      </div>
      {form.formState.errors.email && (
        <p id={`invite-error-${householdId}`} className="auth-field-error">
          {form.formState.errors.email.message}
        </p>
      )}
    </form>
  );
}

function getActionTitle(kind: PendingAction['kind'] | undefined) {
  switch (kind) {
    case 'remove-member': return copy.removeMemberTitle;
    case 'leave-household': return copy.leaveHouseholdTitle;
    case 'delete-household': return copy.householdDeleteTitle;
    default: return '';
  }
}

function getActionDescription(action: PendingAction | null) {
  switch (action?.kind) {
    case 'remove-member': return `${copy.removeMemberConfirmation} ${action.label}?`;
    case 'leave-household': return `${copy.leaveHouseholdConfirmation} ${action.label}?`;
    case 'delete-household': return `${copy.householdDeleteConfirmation} ${action.label}?`;
    default: return '';
  }
}

function getActionConfirmLabel(kind: PendingAction['kind'] | undefined) {
  switch (kind) {
    case 'remove-member': return copy.removeMember;
    case 'leave-household': return copy.leaveHousehold;
    case 'delete-household': return copy.deleteHousehold;
    default: return copy.confirm;
  }
}
