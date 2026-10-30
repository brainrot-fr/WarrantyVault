drop policy "Members can read household invites and invitees can read addressed invites"
on public.household_invites;

create policy "Members and invitees can read pending household invites"
on public.household_invites for select to authenticated
using (
  (select public.is_household_member(household_id))
  or (
    status = 'pending'
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  )
);