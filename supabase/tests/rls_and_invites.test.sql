create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(22);

create temporary table pgtap_results (
  ordinal integer primary key,
  output text not null
);
grant insert on pg_temp.pgtap_results to authenticated;
create temporary table created_household (id uuid);
grant select, insert on pg_temp.created_household to authenticated;

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'member@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'outsider@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'newmember@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'unverified@example.com', '', null, '{}', '{}', now(), now());

insert into public.households (id, name, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Owner home', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Other home', '00000000-0000-0000-0000-000000000003');

insert into public.household_members (household_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'owner');

insert into public.items (id, household_id, name, purchase_date, warranty_months, created_by)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Shared item', '2025-01-01', 12, '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Private item', '2025-01-01', 12, '00000000-0000-0000-0000-000000000003');

insert into public.household_invites (
  id, household_id, email, invited_by, status, expires_at, accepted_at
)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'newmember@example.com', '00000000-0000-0000-0000-000000000003', 'pending', now() + interval '1 day', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member@example.com', '00000000-0000-0000-0000-000000000001', 'pending', now() - interval '1 day', null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'someoneelse@example.com', '00000000-0000-0000-0000-000000000003', 'pending', now() + interval '1 day', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'unverified@example.com', '00000000-0000-0000-0000-000000000001', 'pending', now() + interval '1 day', null);

insert into pg_temp.pgtap_results (ordinal, output)
select 1, extensions.is(
  public.calculate_expiry_date('2024-02-29', 12),
  '2025-02-28'::date,
  'leap-day expiry clamps to the end of February'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 2, extensions.is(
  public.calculate_expiry_date('2025-05-31', 3),
  '2025-08-31'::date,
  'month-end expiry preserves the day when the target month allows it'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","email":"outsider@example.com","role":"authenticated"}',
  true
);
insert into pg_temp.pgtap_results (ordinal, output)
select 3, extensions.throws_ok(
  $$insert into public.households (name, created_by) values ('Unauthorized', '00000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'clients cannot insert households directly'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 4, extensions.is(
  (select count(*)::integer from public.items where household_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'outsiders cannot read household items'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 5, extensions.throws_ok(
  $$insert into public.items (household_id, name) values ('10000000-0000-0000-0000-000000000001', 'Unauthorized')$$,
  '42501',
  null,
  'outsiders cannot insert household items'
);
update public.items
set name = 'Changed by outsider'
where id = '20000000-0000-0000-0000-000000000001';
delete from public.items
where id = '20000000-0000-0000-0000-000000000001';
reset role;
insert into pg_temp.pgtap_results (ordinal, output)
select 6, extensions.is(
  (select name from public.items where id = '20000000-0000-0000-0000-000000000001'),
  'Shared item',
  'outsiders cannot update household items'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 7, extensions.is(
  (select count(*)::integer from public.items where id = '20000000-0000-0000-0000-000000000001'),
  1,
  'outsiders cannot delete household items'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"member@example.com","role":"authenticated"}',
  true
);
insert into pg_temp.pgtap_results (ordinal, output)
select 8, extensions.is(
  (select count(*)::integer from public.items where id = '20000000-0000-0000-0000-000000000002'),
  0,
  'a member cannot read another household item'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 9, extensions.is(
  (select count(*)::integer from public.items where id = '20000000-0000-0000-0000-000000000001'),
  1,
  'a member can read items in their own household'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 10, extensions.is(
  (select count(*)::integer from public.household_invites where id = '30000000-0000-0000-0000-000000000003'),
  0,
  'invitees cannot read invites addressed to another email'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 11, extensions.throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'an invite for another email cannot be accepted'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 12, extensions.throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-000000000002')$$,
  '22023',
  null,
  'expired invites cannot be accepted'
);
select set_config('app.settings.invite_expiry_days', '', true);
insert into public.household_invites (household_id, email, invited_by)
values (
  '10000000-0000-0000-0000-000000000001',
  'seven-days@example.com',
  (select auth.uid())
);
insert into pg_temp.pgtap_results (ordinal, output)
select 13, extensions.ok(
  (select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
   from public.household_invites
   where household_id = '10000000-0000-0000-0000-000000000001'
     and email = 'seven-days@example.com'),
  'new invites default to seven days'
);
select set_config('app.settings.invite_expiry_days', '14', true);
insert into public.household_invites (household_id, email, invited_by)
values (
  '10000000-0000-0000-0000-000000000001',
  'fourteen-days@example.com',
  (select auth.uid())
);
insert into pg_temp.pgtap_results (ordinal, output)
select 14, extensions.ok(
  (select expires_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
   from public.household_invites
   where household_id = '10000000-0000-0000-0000-000000000001'
     and email = 'fourteen-days@example.com'),
  'invite expiration can be configured per database'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@example.com","role":"authenticated"}',
  true
);
insert into pg_temp.pgtap_results (ordinal, output)
select 15, extensions.is(
  public.is_household_owner('10000000-0000-0000-0000-000000000001'),
  true,
  'owner membership is recognized for the owner account'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 16, extensions.throws_ok(
  $$select public.leave_household('10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a household owner cannot leave'
);

with new_household as materialized (
  select public.create_household('Created through RPC') as id
)
insert into pg_temp.created_household (id)
select id from new_household;
insert into pg_temp.pgtap_results (ordinal, output)
select 17, extensions.is(
  (select count(*)::integer
   from public.households
   where id = (select id from pg_temp.created_household)
     and created_by = (select auth.uid())),
  1,
  'create_household creates the household for the caller'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 18, extensions.is(
  (select count(*)::integer
   from public.household_members
   where household_id = (select id from pg_temp.created_household)
     and user_id = (select auth.uid())
     and role = 'owner'),
  1,
  'create_household atomically creates the owner membership'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","email":"newmember@example.com","role":"authenticated"}',
  true
);
insert into pg_temp.pgtap_results (ordinal, output)
select 19, extensions.is(
  public.accept_invite('30000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'a verified invitee can join the addressed household'
);
insert into pg_temp.pgtap_results (ordinal, output)
select 20, extensions.throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-000000000001')$$,
  '22023',
  null,
  'an accepted invite cannot be used a second time'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","email":"unverified@example.com","role":"authenticated"}',
  true
);
insert into pg_temp.pgtap_results (ordinal, output)
select 21, extensions.throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-000000000004')$$,
  '42501',
  null,
  'an unverified email cannot accept an invite'
);
reset role;

insert into pg_temp.pgtap_results (ordinal, output)
select 22, extensions.is(
  (select count(*)::integer from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'reminder_log'),
  0,
  'reminder logs have no client RLS policies'
);

select tap.output
from (
  select ordinal, output from pg_temp.pgtap_results
  union all
  select 9999, finish.*
  from extensions.finish() as finish
) as tap
order by tap.ordinal;
rollback;
