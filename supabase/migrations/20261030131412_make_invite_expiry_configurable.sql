create or replace function public.default_invite_expiry()
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  expiry_days integer := coalesce(
    nullif(pg_catalog.current_setting('app.settings.invite_expiry_days', true), '')::integer,
    7
  );
begin
  if expiry_days < 1 then
    raise exception 'app.settings.invite_expiry_days must be a positive integer.'
      using errcode = '22023';
  end if;

  return pg_catalog.now() + pg_catalog.make_interval(days => expiry_days);
end;
$$;

alter table public.household_invites
  alter column expires_at set default public.default_invite_expiry();

revoke execute on function public.default_invite_expiry() from public, anon, authenticated;
grant execute on function public.default_invite_expiry() to authenticated;