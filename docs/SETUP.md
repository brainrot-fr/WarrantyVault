# Supabase setup

## Email confirmation

Keep **Confirm email** enabled on the hosted project. The invite-accept RPC requires a verified email that matches the invite. In the Supabase Dashboard, check Authentication → Sign In / Providers → Email. Local development enables confirmations in `supabase/config.toml`.

## Invite expiration

Invites expire after seven days by default. To change the default for new invites, run this in the Supabase SQL Editor:

```sql
alter database postgres set app.settings.invite_expiry_days = '14';
```

Use a positive integer for the number of days. Existing invites keep their stored `expires_at` value. New database connections use the updated setting.
