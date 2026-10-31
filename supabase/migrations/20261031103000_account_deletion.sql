alter table public.households
  alter column created_by drop not null;

alter table public.households
  drop constraint households_created_by_fkey;

alter table public.households
  add constraint households_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;
