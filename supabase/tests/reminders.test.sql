create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(5);

select extensions.has_extension('pg_cron', 'pg_cron is enabled for reminder scheduling');
select extensions.has_extension('pg_net', 'pg_net is enabled for Edge Function requests');
select extensions.has_extension('supabase_vault', 'Supabase Vault is enabled');
select extensions.is(
  (select count(*)::integer from cron.job
   where jobname = 'warrantyvault-daily-reminders'),
  1,
  'the daily reminder job is scheduled once'
);
select extensions.is(
  (select schedule from cron.job
   where jobname = 'warrantyvault-daily-reminders'),
  '30 3 * * *',
  'the daily reminder job runs at 03:30 UTC'
);

select * from extensions.finish();

rollback;
