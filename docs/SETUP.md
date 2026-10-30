# Supabase setup

This is the authoritative setup guide for the current React + Supabase +
Cloudinary + Capacitor application. The old Spring/Render deployment and its
SMTP workflow were removed after the parity matrix was completed.

## Prerequisites and local development

Install Node.js and npm, Docker Desktop (required for local Supabase database
tests), and the Supabase CLI. Android Studio is required for Android builds;
Xcode and macOS are required for iOS builds.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The frontend reads only `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` from `.env.local`. Run the app gate before
deployment:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

With Docker running, run the database policy tests:

```bash
npx supabase start
npm run db:test
npx supabase stop --no-backup
```

## Email confirmation

Keep **Confirm email** enabled on the hosted project. The invite-accept RPC requires a verified email that matches the invite. In the Supabase Dashboard, check Authentication → Sign In / Providers → Email. Local development enables confirmations in `supabase/config.toml`.

## Web app environment

Copy the repository-root `.env.example` to `.env.local` and set these values for local development. Set the same public values in the deployment platform's environment settings for production:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the project's current **publishable** key from API Keys, not a secret/service-role key. Both values are public application configuration; RLS is responsible for data authorization. Keep the database password and all secret keys out of `VITE_` variables.

The root `.env.example` contains public frontend values only. Never put Brevo, Cloudinary, Supabase secret, or database credentials in it.

## Vercel deployment

Import the repository into Vercel with the repository root as the project root. Use the Vite defaults: `npm run build` and `dist`. The root `vercel.json` rewrites app routes to `index.html`, so direct navigation and refreshes on paths such as `/items/<id>` continue to work. Add these environment variables for Production, Preview, and Development as needed:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Set them from the Supabase project's API settings. They are public browser configuration; do not add service-role keys, database passwords, Brevo keys, or Cloudinary secrets as `VITE_` variables. Add server-side secrets under Supabase Edge Function Secrets as described below, not in Vercel's browser build environment.

## Google sign-in and redirect URLs

1. In Supabase Dashboard, open Authentication → Sign In / Providers → Google and enable the provider.
2. Add the Google OAuth client ID and client secret from your Google Cloud OAuth client. In Google Cloud, add the Supabase project's callback URL shown by the provider setup as an authorized redirect URI.
3. In Authentication → URL Configuration, set the production Site URL to the production Vercel domain and allow the production app paths, including `/` and `/auth/reset`. Add `http://localhost:5173/**` for local development.
4. To support Vercel Preview deployments, allow `https://*-<team-or-account-slug>.vercel.app/**`, replacing the suffix with the actual team or account slug used by the deployment. Supabase uses `*` only within a single URL segment; use `**` to include nested paths. If previews use a custom domain or a different suffix, add the matching exact URL or pattern. Avoid broad patterns that match domains you do not control.
5. Add the native custom-scheme redirects listed in [MOBILE.md](./MOBILE.md) when enabling Android/iOS builds.
6. Keep email confirmation enabled under the Email provider. For sign-up, users must confirm before they can accept an invite; password reset returns to `/auth/reset`.

The app uses Supabase Auth's PKCE flow for password and Google sign-in. Google sign-in will report an error until the provider and allowed redirect URLs are configured.

The GitHub Actions workflow runs typecheck, lint, Vitest, production build, and local Supabase database tests on pushes and pull requests. A hosted Vercel preview is created by the Vercel Git integration; configure the matching preview URL pattern in Supabase before testing auth from those previews.

## Household invitation email

The `invite-member` Edge Function verifies the caller's session and household membership through an RLS-scoped client, creates or reuses a pending email-bound invite, and sends a transactional email through Brevo's HTTPS API. Resending reuses an active invite; an expired pending invite is replaced using the configured database expiry. It does not expose a link token or use SMTP from the Edge Function. The function requires a verified signed-in email to accept an invitation.

Add these values in the Supabase Dashboard under **Project Settings → Edge Functions → Secrets** (or open **Edge Functions → Secrets** from the project navigation). Add one key/value pair per row and save:

- `BREVO_API_KEY`
- `MAIL_FROM_EMAIL` (verified sender in Brevo)
- `MAIL_FROM_NAME`
- `APP_URL` (the public web app origin, without an invite token)
- `ALLOWED_ORIGINS` (comma-separated exact browser origins, such as the local Vite origin and production origin)

For the Brevo account you already created, add `BREVO_API_KEY` as the key and paste the Brevo API key as its value. Add your verified sender address as `MAIL_FROM_EMAIL` and a display name as `MAIL_FROM_NAME`. Do not send the key in chat, add it to the repository-root `.env.local`, or put it in a `VITE_` variable. The root `.env.example` is only for the public Supabase URL and publishable key.

For local Edge Function development, put these values in the ignored `supabase/functions/.env.local` and pass it explicitly with `--env-file`. Do not commit the local secrets file. The function runtime reads the injected `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEYS`; do not set those manually.

The function reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEYS` from Supabase's injected environment. It uses the publishable key with the caller's Authorization header for RLS checks. A secret API key is used only for narrowly deleting a newly created pending invite if Brevo rejects the email; it never leaves the Edge Function. Do not put any Supabase secret key or Brevo key in a `VITE_` variable.

Deploy after setting the secrets:

```bash
npx supabase functions deploy invite-member
```

Run the function's pure validation and email-content tests locally:

```bash
deno test supabase/functions/invite-member/invite_test.ts
```

Local Edge Functions read the custom env file when it is passed explicitly:

```bash
npx supabase functions serve invite-member --env-file supabase/functions/.env.local
```

This file is ignored by Git. Configure `ALLOWED_ORIGINS` for the actual local port in use (Vite may select another port if 5173 is occupied). Production and preview origins must be listed exactly.

## Cloudinary receipt storage

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the same Supabase Edge Function Secrets page. The API secret is used only by the Edge Functions. `cloudinary-sign` returns a short-lived signed upload request for an authenticated asset in the caller's household folder; the browser never receives the API secret. Deploy the three storage functions after setting the secrets:

```bash
npx supabase functions deploy cloudinary-sign
npx supabase functions deploy cloudinary-url
npx supabase functions deploy receipt-delete
```

`cloudinary-url` returns a 10-minute Cloudinary private-download URL. Cloudinary's private-download endpoint uses an attachment response, so it downloads instead of rendering inline; the receipt viewer can use the fetched file for a local preview. The temporary link is a bearer URL and can be shared until it expires.

Claim packs fetch that short-lived URL with browser CORS enabled, then embed the receipt bytes in the generated PDF. Cloudinary's private-download API responded with an allowed origin in a CORS preflight check; verify the deployed Cloudinary endpoint from the app's production origin if you change delivery settings. A failed fetch is shown in the app, and the item facts can still be downloaded by retrying after receipt access is restored.

## Warranty reminder emails

The `send-reminders` Edge Function sends one digest per opted-in household member for items expiring in exactly 30 or 7 days. Add `CRON_SECRET`, `APP_TIMEZONE` (an IANA time zone such as `Asia/Kolkata`), and optionally `MAX_EMAILS_PER_RUN` (defaults to `250`) to **Project Settings → Edge Functions → Secrets**. Use the same `CRON_SECRET` for the database Vault entry described in [OPERATIONS.md](./OPERATIONS.md). The function also uses the existing `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, and `APP_URL` values.

Deploy with `npx supabase functions deploy send-reminders`. The function has JWT verification disabled and rejects requests without the matching `x-cron-secret` header. The migration schedules it daily at 03:30 UTC; see [OPERATIONS.md](./OPERATIONS.md) to store the project URL and cron secret in Vault and verify the schedule.

## Offline OCR and PDF reading

The app vendors the Tesseract worker, WebAssembly cores, English trained data, PDF.js worker, CMaps, standard fonts, and PDF decoders under `public/`. Their matching npm versions are recorded in `package.json` and `package-lock.json`; keep the bundled assets in sync when upgrading those packages. OCR and PDF.js are dynamically imported only when receipt reading starts, and OCR does not depend on a CDN or network download.

## Invite expiration

Invites expire after seven days by default. To change the default for new invites, run this in the Supabase SQL Editor:

```sql
alter database postgres set app.settings.invite_expiry_days = '14';
```

Use a positive integer for the number of days. Existing invites keep their stored `expires_at` value. New database connections use the updated setting.
