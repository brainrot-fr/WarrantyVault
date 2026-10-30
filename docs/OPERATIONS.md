# Operations

## Daily warranty reminders

The reminder migration enables `pg_cron`, `pg_net`, and Supabase Vault after checking that the extensions are available. It creates the `warrantyvault-daily-reminders` job for 03:30 UTC. The job does not send anything until both Vault secrets below exist.

1. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, set `CRON_SECRET` to a long random value, set `APP_TIMEZONE` to the product's IANA time zone, and optionally set `MAX_EMAILS_PER_RUN` (default `250`). The same Edge Function environment needs `APP_URL`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, and `MAIL_FROM_NAME`.
2. In the Supabase Dashboard's Database → Vault, create secrets with these exact names:
   - `warrantyvault_project_url`: the project URL, such as `https://<project-ref>.supabase.co`
   - `warrantyvault_cron_secret`: the exact same value as the Edge Function `CRON_SECRET`
3. Deploy the function with `npx supabase functions deploy send-reminders`. `supabase/config.toml` disables JWT verification for this function; requests are authenticated with the timing-safe `x-cron-secret` comparison.
4. Confirm the job is active:

   ```sql
   select jobname, schedule, active
   from cron.job
   where jobname = 'warrantyvault-daily-reminders';
   ```

`pg_net` queues the request and its headers until the HTTP call is sent. Supabase notes that database roles able to read `net.http_request_queue` can see queued headers during that short interval; keep database access restricted.

### Manual trigger

Use the project URL and cron secret from your local shell environment. Do not paste the secret into source files or commit it:

```bash
curl --fail-with-body --silent --show-error \
  -X POST "$SUPABASE_URL/functions/v1/send-reminders" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --data '{}'
```

The response includes the date used in `APP_TIMEZONE`, eligible and skipped email counts, sent and failed digests, deduplicated digests, and item-log cleanup counts. A failed recipient's newly claimed log rows are removed so a later run can retry; other recipients continue. Repeating a successful run for the same reminder date sends no duplicate digest because each item/user/date is claimed with `ON CONFLICT DO NOTHING`.

To inspect scheduled HTTP results:

```sql
select id, status_code, timed_out, error_msg, created
from net._http_response
order by created desc
limit 20;
```
