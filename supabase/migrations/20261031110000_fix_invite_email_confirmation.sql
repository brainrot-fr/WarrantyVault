create or replace function public.list_my_invites()
returns table (
  id uuid,
  household_id uuid,
  household_name text,
  inviter_name text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    invite.id,
    invite.household_id,
    household.name,
    coalesce(profile.display_name, profile.email),
    invite.expires_at
  from public.household_invites as invite
  join public.households as household on household.id = invite.household_id
  left join public.profiles as profile on profile.id = invite.invited_by
  where invite.status = 'pending'
    and invite.expires_at > now()
    and lower(invite.email) = lower(coalesce(auth.jwt()->>'email', ''))
    and exists (
      select 1
      from auth.users as users
      where users.id = auth.uid()
        and users.email_confirmed_at is not null
    );
$$;

revoke execute on function public.list_my_invites() from public, anon;
grant execute on function public.list_my_invites() to authenticated;
