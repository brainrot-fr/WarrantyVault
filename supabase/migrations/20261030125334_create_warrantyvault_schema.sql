create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  email_reminders boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default pg_catalog.now(),
  primary key (household_id, user_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (pg_catalog.now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  brand text,
  category text,
  merchant text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(12, 2),
  currency text,
  warranty_months integer check (warranty_months >= 0),
  expiry_date date,
  notes text,
  receipt_public_id text,
  receipt_resource_type text,
  receipt_format text,
  receipt_bytes bigint,
  receipt_filename text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reminder_date date not null,
  days_before integer not null check (days_before in (7, 30)),
  sent_at timestamptz not null default pg_catalog.now(),
  unique (item_id, user_id, reminder_date)
);

create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_role_idx on public.household_members (household_id, role);
create unique index household_invites_pending_email_idx
  on public.household_invites (household_id, lower(email))
  where status = 'pending';
create index household_invites_email_pending_idx
  on public.household_invites (lower(email))
  where status = 'pending';
create index household_invites_invited_by_idx on public.household_invites (invited_by);
create index items_household_id_idx on public.items (household_id);
create index items_expiry_date_idx on public.items (expiry_date);
create index items_created_by_idx on public.items (created_by);
create index reminder_log_user_id_idx on public.reminder_log (user_id);

create or replace function public.calculate_expiry_date(purchase_date date, warranty_months integer)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  target_month date;
  target_month_last_day integer;
begin
  target_month := (
    pg_catalog.date_trunc('month', purchase_date)::date
    + pg_catalog.make_interval(months => warranty_months)
  )::date;
  target_month_last_day := extract(
    day from (target_month + pg_catalog.make_interval(months => 1) - interval '1 day')
  )::integer;

  return target_month
    + least(extract(day from purchase_date)::integer, target_month_last_day)
    - 1;
end;
$$;

create or replace function public.set_item_expiry_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.purchase_date is null or new.warranty_months is null then
    new.expiry_date := null;
  else
    new.expiry_date := public.calculate_expiry_date(new.purchase_date, new.warranty_months);
  end if;

  return new;
end;
$$;

create trigger items_set_expiry_date
before insert or update of purchase_date, warranty_months on public.items
for each row execute function public.set_item_expiry_date();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    )
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_profile();

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.handle_auth_user_profile();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'
  );
$$;

create or replace function public.create_household(name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create a household.' using errcode = '42501';
  end if;
  if name is null or btrim(name) = '' then
    raise exception 'Household name cannot be empty.' using errcode = '22023';
  end if;

  insert into public.households (name, created_by)
  values (btrim(name), current_user_id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');

  return new_household_id;
end;
$$;

create or replace function public.accept_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  verified_email text;
  jwt_email text := (select auth.jwt() ->> 'email');
  invite public.household_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to accept an invite.' using errcode = '42501';
  end if;

  select users.email
  into verified_email
  from auth.users as users
  where users.id = current_user_id
    and users.email_confirmed_at is not null;

  if verified_email is null or jwt_email is null then
    raise exception 'A verified email address is required to accept an invite.' using errcode = '42501';
  end if;

  select pending_invite.*
  into invite
  from public.household_invites as pending_invite
  where pending_invite.id = $1
  for update;

  if not found or invite.status <> 'pending' then
    raise exception 'Invite is not pending.' using errcode = '22023';
  end if;
  if invite.expires_at <= pg_catalog.now() then
    raise exception 'Invite has expired.' using errcode = '22023';
  end if;
  if lower(verified_email) <> lower(invite.email)
    or lower(jwt_email) <> lower(invite.email) then
    raise exception 'The verified account email does not match this invite.' using errcode = '42501';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, current_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set status = 'accepted',
      accepted_at = pg_catalog.now()
  where id = invite.id;

  return invite.household_id;
end;
$$;

create or replace function public.decline_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  jwt_email text := (select auth.jwt() ->> 'email');
  invite public.household_invites%rowtype;
begin
  if current_user_id is null or jwt_email is null then
    raise exception 'Authentication is required to decline an invite.' using errcode = '42501';
  end if;

  select pending_invite.*
  into invite
  from public.household_invites as pending_invite
  where pending_invite.id = $1
  for update;

  if not found
    or invite.status <> 'pending'
    or lower(invite.email) <> lower(jwt_email) then
    raise exception 'Invite is unavailable to this account.' using errcode = '42501';
  end if;

  delete from public.household_invites where id = invite.id;
end;
$$;

create or replace function public.remove_member(household_id uuid, user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_owner($1) then
    raise exception 'Only a household owner can remove members.' using errcode = '42501';
  end if;

  delete from public.household_members as membership
  where membership.household_id = $1
    and membership.user_id = $2
    and membership.role = 'member';

  if not found then
    raise exception 'Household member was not found or cannot be removed.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.leave_household(household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to leave a household.' using errcode = '42501';
  end if;

  select membership.role
  into current_role
  from public.household_members as membership
  where membership.household_id = $1
    and membership.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Household membership was not found.' using errcode = '22023';
  end if;
  if current_role = 'owner' then
    raise exception 'The household owner cannot leave the household.' using errcode = '42501';
  end if;

  delete from public.household_members as membership
  where membership.household_id = $1
    and membership.user_id = current_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.items enable row level security;
alter table public.reminder_log enable row level security;

revoke all on table public.profiles, public.households, public.household_members,
  public.household_invites, public.items, public.reminder_log
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, email_reminders) on public.profiles to authenticated;

grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant delete on public.households to authenticated;

grant select on public.household_members to authenticated;

grant select on public.household_invites to authenticated;
grant insert (household_id, email, invited_by) on public.household_invites to authenticated;
grant update (status) on public.household_invites to authenticated;

grant select, delete on public.items to authenticated;
grant insert (
  household_id, name, brand, category, merchant, serial_number, purchase_date,
  purchase_price, currency, warranty_months, notes, receipt_public_id,
  receipt_resource_type, receipt_format, receipt_bytes, receipt_filename
) on public.items to authenticated;
grant update (
  name, brand, category, merchant, serial_number, purchase_date, purchase_price,
  currency, warranty_months, notes, receipt_public_id, receipt_resource_type,
  receipt_format, receipt_bytes, receipt_filename
) on public.items to authenticated;

grant all on public.reminder_log to service_role;

create policy "Profiles are visible to self and household members"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.household_members as other_member
    where other_member.user_id = profiles.id
      and (select public.is_household_member(other_member.household_id))
  )
);

create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Household members can read their households"
on public.households for select to authenticated
using ((select public.is_household_member(id)));

create policy "Household members can rename their households"
on public.households for update to authenticated
using ((select public.is_household_member(id)))
with check ((select public.is_household_member(id)));

create policy "Only owners can delete households"
on public.households for delete to authenticated
using ((select public.is_household_owner(id)));

create policy "Household members can read memberships"
on public.household_members for select to authenticated
using ((select public.is_household_member(household_id)));

create policy "Members can read household invites and invitees can read addressed invites"
on public.household_invites for select to authenticated
using (
  (select public.is_household_member(household_id))
  or lower(email) = lower((select auth.jwt() ->> 'email'))
);

create policy "Household members can create invites in their household"
on public.household_invites for insert to authenticated
with check (
  (select public.is_household_member(household_id))
  and invited_by = (select auth.uid())
);

create policy "Owners can revoke pending invites"
on public.household_invites for update to authenticated
using (
  (select public.is_household_owner(household_id))
  and status = 'pending'
)
with check (
  (select public.is_household_owner(household_id))
  and status = 'revoked'
);

create policy "Household members can read items"
on public.items for select to authenticated
using ((select public.is_household_member(household_id)));

create policy "Household members can create items"
on public.items for insert to authenticated
with check (
  (select public.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy "Household members can update items"
on public.items for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));

create policy "Household members can delete items"
on public.items for delete to authenticated
using ((select public.is_household_member(household_id)));

revoke execute on function public.calculate_expiry_date(date, integer) from public, anon, authenticated;
revoke execute on function public.set_item_expiry_date() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_profile() from public, anon, authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_household_owner(uuid) from public, anon, authenticated;
revoke execute on function public.create_household(text) from public, anon, authenticated;
revoke execute on function public.accept_invite(uuid) from public, anon, authenticated;
revoke execute on function public.decline_invite(uuid) from public, anon, authenticated;
revoke execute on function public.remove_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.leave_household(uuid) from public, anon, authenticated;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.decline_invite(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;