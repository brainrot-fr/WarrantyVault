do $$
declare
  missing_extensions text;
begin
  select string_agg(required.name, ', ')
  into missing_extensions
  from (values ('pg_cron'), ('pg_net'), ('supabase_vault')) as required(name)
  where not exists (
    select 1
    from pg_catalog.pg_available_extensions as available
    where available.name = required.name
  );

  if missing_extensions is not null then
    raise exception 'Required reminder extensions are unavailable: %', missing_extensions;
  end if;
end;
$$;

create schema if not exists extensions;
create schema if not exists vault;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'warrantyvault-daily-reminders'
  ) then
    perform cron.schedule(
      'warrantyvault-daily-reminders',
      '30 3 * * *',
      $job$
      with secrets as (
        select
          max(decrypted_secret) filter (
            where name = 'warrantyvault_project_url'
          ) as project_url,
          max(decrypted_secret) filter (
            where name = 'warrantyvault_cron_secret'
          ) as cron_secret
        from vault.decrypted_secrets
        where name in (
          'warrantyvault_project_url',
          'warrantyvault_cron_secret'
        )
      )
      select net.http_post(
        url := secrets.project_url || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', secrets.cron_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      )
      from secrets
      where secrets.project_url is not null
        and secrets.cron_secret is not null;
      $job$
    );
  end if;
end;
$$;
