create or replace function public.leave_household(household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_membership_role text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to leave a household.' using errcode = '42501';
  end if;

  select membership.role
  into v_membership_role
  from public.household_members as membership
  where membership.household_id = $1
    and membership.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Household membership was not found.' using errcode = '22023';
  end if;
  if v_membership_role = 'owner' then
    raise exception 'The household owner cannot leave the household.' using errcode = '42501';
  end if;

  delete from public.household_members as membership
  where membership.household_id = $1
    and membership.user_id = current_user_id;
end;
$$;