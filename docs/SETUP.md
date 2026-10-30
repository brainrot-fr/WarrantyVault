# Supabase setup

## Email confirmation

Keep **Confirm email** enabled on the hosted project. The invite-accept RPC requires a verified email that matches the invite. In the Supabase Dashboard, check Authentication → Sign In / Providers → Email. Local development enables confirmations in `supabase/config.toml`.

## Web app environment

Set these in the repository-root `.env.local` for local development and in the deployment platform's environment settings for production:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the project's current **publishable** key from API Keys, not a secret/service-role key. Both values are public application configuration; RLS is responsible for data authorization. Keep the database password and all secret keys out of `VITE_` variables.

## Google sign-in and redirect URLs

1. In Supabase Dashboard, open Authentication → Sign In / Providers → Google and enable the provider.
2. Add the Google OAuth client ID and client secret from your Google Cloud OAuth client. In Google Cloud, add the Supabase project's callback URL shown by the provider setup as an authorized redirect URI.
3. In Authentication → URL Configuration, set the production Site URL and allow the app callback URLs, including `http://localhost:5173/`, `http://localhost:5173/auth/reset`, and the corresponding production origin paths. Add each preview origin explicitly when using preview deployments.
4. Keep email confirmation enabled under the Email provider. For sign-up, users must confirm before they can accept an invite; password reset returns to `/auth/reset`.

The app uses Supabase Auth's PKCE flow for password and Google sign-in. Google sign-in will report an error until the provider and allowed redirect URLs are configured.

## Invite expiration

Invites expire after seven days by default. To change the default for new invites, run this in the Supabase SQL Editor:

```sql
alter database postgres set app.settings.invite_expiry_days = '14';
```

Use a positive integer for the number of days. Existing invites keep their stored `expires_at` value. New database connections use the updated setting.
