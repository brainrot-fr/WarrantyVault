# Supabase setup

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

## Google sign-in and redirect URLs

1. In Supabase Dashboard, open Authentication → Sign In / Providers → Google and enable the provider.
2. Add the Google OAuth client ID and client secret from your Google Cloud OAuth client. In Google Cloud, add the Supabase project's callback URL shown by the provider setup as an authorized redirect URI.
3. In Authentication → URL Configuration, set the production Site URL and allow the app callback URLs, including `http://localhost:5173/`, `http://localhost:5173/auth/reset`, and the corresponding production origin paths. Add each preview origin explicitly when using preview deployments.
4. Keep email confirmation enabled under the Email provider. For sign-up, users must confirm before they can accept an invite; password reset returns to `/auth/reset`.

The app uses Supabase Auth's PKCE flow for password and Google sign-in. Google sign-in will report an error until the provider and allowed redirect URLs are configured.

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

## Offline OCR and PDF reading

The app vendors the Tesseract worker, WebAssembly cores, English trained data, PDF.js worker, CMaps, standard fonts, and PDF decoders under `public/`. Their matching npm versions are recorded in `package.json` and `package-lock.json`; keep the bundled assets in sync when upgrading those packages. OCR and PDF.js are dynamically imported only when receipt reading starts, and OCR does not depend on a CDN or network download.

## Invite expiration

Invites expire after seven days by default. To change the default for new invites, run this in the Supabase SQL Editor:

```sql
alter database postgres set app.settings.invite_expiry_days = '14';
```

Use a positive integer for the number of days. Existing invites keep their stored `expires_at` value. New database connections use the updated setting.
