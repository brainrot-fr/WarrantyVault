# WarrantyVault setup and deployment

This guide takes you from a clean checkout to a deployed app. Keep the backend and frontend environment files separate: the frontend receives only the Supabase public URL/anon key and API URL; the Supabase service-role key, database password, SMTP password, JWT secret, and cron secret belong only in backend/deployment secrets.

## 1. Prerequisites and versions

Install the following:

| Tool | Version | Check |
|---|---:|---|
| Git | Current stable | `git --version` |
| Java Development Kit | 21 | `java -version` |
| Maven | 3.9 or later | `mvn -version` |
| Node.js | 20 or later | `node --version` |
| npm | Included with Node.js | `npm --version` |
| Docker | Optional, for a local container build | `docker --version` |
| Tesseract OCR | Optional for local OCR; the backend image installs it | `tesseract --version` |

On Ubuntu/Debian, install Java 21, Maven, Node 20+, and Tesseract using your distribution's supported package repositories. macOS users can use Homebrew; Windows users can use a JDK distribution, Maven, Node.js installer, and Tesseract installer. The repository targets Java 21; Java 17 is not sufficient.

For local OCR, install the English Tesseract language data as well as the Tesseract executable. If you cannot install OCR locally, set `OCR_ENABLED=false`; bill upload, manual entry, and all non-OCR features continue to work.

## 2. Supabase project setup

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard), sign in, choose **New project**, select an organization, and enter a project name, database password, and region. Store the database password securely; it is not recoverable in plain text later.
2. After provisioning, open **Project Settings > API**. Record:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Project API keys > anon/public**: frontend public key
   - **Project API keys > service_role/secret**: backend-only key; never put this in a frontend variable.
   - The **project ref** is the host prefix before `.supabase.co` in the Project URL.
3. Open **Project Settings > Database > Connection string**. Select the **Transaction pooler** connection string (port `6543`) for Render/production. Its host looks like `aws-0-<region>.pooler.supabase.com`; its username is `postgres.<project-ref>`. Replace the password placeholder with the database password from project creation. Convert the URI to the JDBC form:

   ```text
   jdbc:postgresql://aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0
   ```

   Use the actual pooler host and region shown in the Supabase dashboard. Set the JDBC URL, pooler username, and database password in the backend environment variables below. `prepareThreshold=0` is required with Supabase transaction pooling.
4. Open **Storage > New bucket**, set **Name** to `bills`, leave **Public bucket** off, and select **Create bucket**. The backend uses the service role to upload/read objects and returns expiring signed URLs to authenticated users. Do not add a public read policy.
5. Confirm the signing-key endpoint under **Project Settings > API > JWT Settings**. For the asymmetric signing keys, the JWKS endpoint is:

   ```text
   https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```

   The expected issuer is `https://<project-ref>.supabase.co/auth/v1`. Set the project-ref/JWKS-related backend variables to this same project. If the project uses a legacy HS256 JWT, `SUPABASE_JWT_SECRET` can be supplied to the backend; leave it unset when Supabase JWKS is configured.
6. Open **Authentication > URL Configuration**:
   - **Site URL**: `http://localhost:5173` while developing locally. After Vercel is deployed, change this to the final production URL, for example `https://warrantyvault.vercel.app`.
   - **Redirect URLs**: add `http://localhost:5173/**` and the exact production URL plus `https://<your-project>*.vercel.app/**` if preview deployments need Supabase redirects. Use the actual Vercel project URL/prefix. Keep localhost configured for development.
7. Apply the database schema by starting the backend once after its database variables are set. Flyway creates/updates the schema automatically; do not use Hibernate schema creation.

## 3. Google OAuth setup

1. Open [https://console.cloud.google.com/](https://console.cloud.google.com/), create or select a Google Cloud project, and open **Google Auth Platform > Branding** (older consoles show **APIs & Services > OAuth consent screen**).
2. Configure the consent screen as **External**, enter the app name `WarrantyVault`, provide a user-support email and developer contact email, and save. While the app is unpublished/testing, add each tester under **Google Auth Platform > Audience > Test users**. A user not in that list cannot complete test-mode sign-in.
3. Open **Google Auth Platform > Clients > Create client** (or **APIs & Services > Credentials > Create Credentials > OAuth client ID**). Choose **Web application**.
4. Under **Authorized JavaScript origins**, add `http://localhost:5173` and the production Vercel origin (for example, `https://warrantyvault.vercel.app`). Add preview origins only if needed.
5. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   This is the Supabase callback URL, not the Vercel URL. Replace `<project-ref>` with the project ref from section 2. Copy the generated OAuth **Client ID** and **Client secret**.
6. In the Supabase dashboard open **Authentication > Providers > Google**, enable Google, paste the Client ID and Client secret, then save.
7. While Google's consent screen is in testing, users may see an **unverified app** warning. Confirm the exact app identity and proceed only with an account added under **Audience > Test users**. To remove the test-user restriction for general use, complete Google's verification/publishing requirements.

## 4. Email sending and design-system tooling

### SMTP option A: Gmail

1. Turn on **Google Account > Security > 2-Step Verification**.
2. Open **Google Account > Security > 2-Step Verification > App passwords**, create an app password named `WarrantyVault`, and copy the one-time password. Use the app password, not your normal Google password.
3. Set backend SMTP values to host `smtp.gmail.com`, port `587`, username your complete Gmail address, and password the app password. Set the sender address to the same Gmail address.

### SMTP option B: Brevo

1. Create an account at [https://www.brevo.com/](https://www.brevo.com/), verify the sender address under **Settings > Senders, Domains & Dedicated IPs > Senders**, and create an SMTP key under **Transactional > Settings > SMTP & API > SMTP**.
2. Set host `smtp-relay.brevo.com`, port `587`, username the SMTP login displayed by Brevo (not necessarily your email address), password the generated SMTP key, and sender address to the verified sender.

Set the applicable values in the backend environment as `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM`. Enable `MAIL_SMTP_AUTH=true` and `MAIL_SMTP_STARTTLS=true` for Gmail/Brevo. Never place SMTP credentials in the frontend.

### UI/UX Pro Max

Python 3 is required to run the local search utility. Install and initialize the assistant skill with:

```bash
npm install -g ui-ux-pro-max-cli
uipro init --ai copilot
```

This repository includes the UI/UX Pro Max reference in `ui-ux-pro-max-skill/`. From the repository root, the following commands regenerate the project Master design system and its dashboard page override:

```bash
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "WarrantyVault premium bill and warranty tracker glass dashboard" --design-system --variance 4 --motion 2 --density 4 --persist --force --project-name WarrantyVault --output-dir .
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "WarrantyVault warranty items dashboard expiry states" --design-system --variance 4 --motion 2 --density 4 --persist --force --project-name WarrantyVault --page dashboard --output-dir .
```

The design system is committed under `design-system/warrantyvault/` and is a development reference; it is not needed to build or deploy the frontend. The local `design/ui-ux-promax/` reference is also not needed to build the app. Vercel's root directory is `frontend/`, so neither reference is part of the deployed frontend build.

## 5. Run locally

1. Create backend configuration:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env` with your Supabase project ref/URL, service role key, pooler JDBC URL and credentials, CORS origin `http://localhost:5173`, and SMTP values. Set `OCR_ENABLED=true` only when local Tesseract is installed. Keep `SCHEDULER_ENABLED=false` for normal local development. Use a long random value for `CRON_SECRET`.
2. Load the backend environment variables in your shell. For Bash/Zsh:

   ```bash
   set -a
   . ./backend/.env
   set +a
   ```

   The application does not read `.env` automatically. Alternatively, set the variables in your IDE's run configuration.
3. Start the backend from `backend/` with the local profile:

   ```bash
   cd backend
   mvn spring-boot:run -Dspring-boot.run.profiles=local
   ```

   The first launch runs Flyway migrations. The API listens on `http://localhost:8080` by default.
4. In another terminal, create the frontend environment:

   ```bash
   cd frontend
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL` to the Supabase Project URL, `VITE_SUPABASE_ANON_KEY` to the anon/public key, and `VITE_API_BASE_URL` to `http://localhost:8080/api`.
5. Install and run the frontend:

   ```bash
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

### Local smoke-test checklist

- [ ] Open the app and register/sign in using Supabase email/password or Google OAuth.
- [ ] Add an item by uploading a JPG, PNG, or PDF under 5 MB; confirm OCR pre-fills fields if enabled, then correct/save the values.
- [ ] Confirm the item appears in the correct Active, Expiring Soon, or Expired dashboard section with a countdown/status.
- [ ] Open item details, preview the bill, edit a field, and verify deletion if appropriate.
- [ ] Generate and download the item's claim-pack PDF.
- [ ] Create a household, invite another email, and accept the invite using a second account.
- [ ] With a configured SMTP account and an item whose expiry is exactly 30 or 7 days away, trigger the reminder endpoint:

   ```bash
   curl -i -X POST http://localhost:8080/api/internal/run-reminders \
     -H "X-Cron-Secret: <the-same-CRON_SECRET>"
   ```

   The endpoint is intended to be authenticated by this secret header. Check backend logs and the recipient inbox for the result.

## 6. Deploy backend to Render

1. Push the repository to GitHub and open [https://dashboard.render.com/](https://dashboard.render.com/).
2. Select **New + > Blueprint**, connect the GitHub repository, and let Render read the root `render.yaml`. The blueprint defines a Docker web service and health check path `/api/health`. If creating the service manually, choose **New + > Web Service**, select the repo, set **Runtime** to **Docker**, and set **Root Directory** to `backend`.
3. Under the service's **Environment** tab, add every backend value from the variable table below. Use the Supabase **transaction pooler** JDBC URL and the `postgres.<project-ref>` pooler username. Mark secrets as secret/private in Render. Set `CORS_ALLOWED_ORIGINS` to the exact Vercel production origin, with `http://localhost:5173` retained if local development still needs to call production.
4. Confirm the health check path is `/api/health`, then deploy. The Docker image builds the Maven application and includes Tesseract plus English data. Render supplies `PORT`; the container listens on it.
5. Free instances may sleep after inactivity and take time to wake. The 512 MB memory limit is why the image sets `JAVA_TOOL_OPTIONS="-Xmx350m -XX:+UseSerialGC"` and why OCR can be disabled. To inspect startup, migration, SMTP, and request errors, open the service in Render and choose **Logs**.

## 7. Deploy frontend to Vercel

1. Open [https://vercel.com/new](https://vercel.com/new), import the GitHub repository, and set **Root Directory** to `frontend/`.
2. Select **Vite** as the framework preset. Build command is `npm run build`; output directory is `dist` (Vercel normally detects both).
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon/public key
   - `VITE_API_BASE_URL` = `https://<render-service>.onrender.com/api`
4. Deploy and copy the final production URL, for example `https://warrantyvault.vercel.app`.
5. **Close the configuration loop:** return to Supabase **Authentication > URL Configuration** and set the production Site URL/add redirect URL. Return to Google Auth Platform **Clients** and add the Vercel origin under Authorized JavaScript origins. Return to Render **Environment** and update `CORS_ALLOWED_ORIGINS` to include the exact production Vercel origin. Save/redeploy Render after changing its CORS value. Add Vercel preview patterns only if you intentionally use preview deployments.

## 8. Schedule reminders

Use either a free external cron service or the optional GitHub Actions workflow. Do not enable both unless duplicate daily runs are acceptable; the reminder log is designed to prevent duplicate sends.

### cron-job.org

1. Create an account at [https://cron-job.org/](https://cron-job.org/) and choose **Cronjobs > Create cronjob**.
2. Set the URL to `https://<render-service>.onrender.com/api/internal/run-reminders`.
3. Set request method to `POST`.
4. Under **Advanced > Request headers**, add header name `X-Cron-Secret` and value equal to the backend `CRON_SECRET`.
5. Set the schedule to once per day (for example, 09:00 UTC), save, then use the service's **Run now** action once and check the response and Render logs.

The daily request also wakes a sleeping free Render service; the first request may be delayed by a cold start. Do not use a cron service with a URL containing the secret; pass it only in the request header.

### GitHub Actions alternative

If `.github/workflows/reminders.yml` is present, open the GitHub repository **Settings > Secrets and variables > Actions > New repository secret** and add `BACKEND_BASE_URL` (for example, `https://<render-service>.onrender.com`) and `CRON_SECRET`. The workflow sends one daily `POST` to `/api/internal/run-reminders`. Use GitHub Actions scheduling instead of cron-job.org if preferred; schedules can be delayed under GitHub load.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| API responds `401` after login | Supabase issuer, project ref, or JWKS URL does not match the token's `iss` claim | Compare the JWT `iss` to `https://<project-ref>.supabase.co/auth/v1`; verify backend project ref and JWKS URL use the same Supabase project. Use `SUPABASE_JWT_SECRET` only for a legacy HS256 project without JWKS configuration. |
| Google returns `redirect_uri_mismatch` | OAuth client callback is not the Supabase callback URI | In Google Auth Platform > Clients, set the redirect to `https://<project-ref>.supabase.co/auth/v1/callback` exactly; do not substitute the app or Vercel URL. |
| Browser reports CORS errors | Production Vercel origin is missing or includes a path/trailing mismatch | Set backend `CORS_ALLOWED_ORIGINS` to comma-separated origins (scheme + host only), including `http://localhost:5173` and the exact production origin; redeploy backend. |
| Render cold-start request times out | Free instance slept before the first request | Retry after the service wakes, increase client/API timeout if appropriate, or schedule a daily harmless reminder run to keep it warm. |
| Render exits for out-of-memory | OCR/Tesseract workload or heap exceeds the small instance budget | Set `OCR_ENABLED=false`, verify `JAVA_TOOL_OPTIONS=-Xmx350m -XX:+UseSerialGC`, and keep Hikari pool size at 5. |
| Flyway or database connection fails | Wrong pooler host/user/password, SSL mode missing, or transaction pooling prepared statements | Use the transaction-pooler host on port `6543`, username `postgres.<project-ref>`, correct database password, `sslmode=require`, and `prepareThreshold=0`. |
| `tesseract` executable/language not found | Tesseract is missing locally or the English trained data is unavailable | Install `tesseract-ocr` and `tesseract-ocr-eng`; for quick local development set `OCR_ENABLED=false`. Render's Docker image should install both packages. |
| Bill upload is rejected | File is over 5 MB or not a supported JPEG/PNG/PDF | Upload a `.jpg`, `.jpeg`, `.png`, or `.pdf` smaller than 5 MB. The backend also checks the received media type. |
| Reminder endpoint returns unauthorized | Header absent or differs from `CRON_SECRET` | Send `X-Cron-Secret` with the exact backend secret; do not send it as a query parameter. |

## 10. Security notes

- Never commit `.env` files or paste credentials into source files, issues, screenshots, or frontend code. `.gitignore` excludes local environment files while retaining `.env.example`.
- The Supabase `service_role` key bypasses Row Level Security. It must stay backend-only and be stored in Render's secret environment settings.
- The Supabase anon/public key is intended for the browser; it is not a substitute for API authorization.
- If any secret is exposed, rotate it immediately in its provider (Supabase, Google, SMTP provider, or Render) and redeploy affected services.
- Use HTTPS in production, a strong random `CRON_SECRET`, verified SMTP senders, and only the Vercel origins you intend to allow.
- Uploaded receipts can contain personal data. Keep the Storage bucket private and share item access only with intended household members.

## Environment-variable reference

Use these values as an inventory. Set backend-only rows in `backend/.env` for local development and in Render's **Environment** tab for production. Set Vercel variables in **Project > Settings > Environment Variables**. Never place backend secrets in Vercel.

| Name | Where it is set | Example (placeholder only) | Where to find/value |
|---|---|---|---|
| `SUPABASE_URL` | Backend local/Render; frontend `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase **Project Settings > API > Project URL** |
| `SUPABASE_PROJECT_REF` | Backend local/Render | `<project-ref>` | Project URL host prefix before `.supabase.co` |
| `SUPABASE_JWKS_URL` | Backend local/Render, optional explicit override | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (or empty) | Supabase project ref; when empty and no legacy secret is set, the backend derives the URL from the project URL/ref |
| `SUPABASE_JWT_SECRET` | Backend local/Render, optional legacy HS256 only | `<legacy-jwt-secret>` | Supabase **Project Settings > API > JWT Settings**; used only when `SUPABASE_JWKS_URL` is empty |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend local/Render only | `<service-role-key>` | Supabase **Project Settings > API > Project API keys > service_role/secret** |
| `SUPABASE_STORAGE_BUCKET` | Backend local/Render | `bills` | Name of the private bucket created in Supabase Storage |
| `SUPABASE_DB_URL` | Backend local/Render | `jdbc:postgresql://<pooler-host>:6543/postgres?sslmode=require&prepareThreshold=0` | Supabase **Project Settings > Database > Connection string > Transaction pooler**, converted to JDBC |
| `SUPABASE_DB_USERNAME` | Backend local/Render | `postgres.<project-ref>` | Username from the Supabase transaction pooler connection string |
| `SUPABASE_DB_PASSWORD` | Backend local/Render | `<database-password>` | Password set when creating the Supabase project |
| `CORS_ALLOWED_ORIGINS` | Backend local/Render | `http://localhost:5173,https://<your-app>.vercel.app` | Local Vite origin plus exact deployed Vercel origin |
| `OCR_ENABLED` | Backend local/Render | `true` locally with Tesseract; `false` on low-memory hosts | Operator choice; the Docker image installs Tesseract and English data |
| `MAIL_HOST` | Backend local/Render | `smtp.gmail.com` or `smtp-relay.brevo.com` | Selected SMTP provider |
| `MAIL_PORT` | Backend local/Render | `587` | Selected SMTP provider's STARTTLS port |
| `MAIL_USERNAME` | Backend local/Render | `<smtp-login>` | Gmail email address or Brevo SMTP login |
| `MAIL_PASSWORD` | Backend local/Render | `<app-password-or-smtp-key>` | Gmail app password or Brevo SMTP key |
| `MAIL_FROM` | Backend local/Render | `warrantyvault@example.com` | Sender email authorized by your SMTP provider |
| `MAIL_SMTP_AUTH` | Backend local/Render | `true` for Gmail/Brevo | Enable SMTP authentication for the selected provider |
| `MAIL_SMTP_STARTTLS` | Backend local/Render | `true` for Gmail/Brevo | Enable STARTTLS for the selected provider |
| `CRON_SECRET` | Backend local/Render and cron/GitHub secret store | `<long-random-secret>` | Generate a unique random secret; use exactly the same value in cron headers |
| `SCHEDULER_ENABLED` | Backend local/Render | `false` | Set `true` only when using the backend's daily scheduler |
| `PORT` | Render-provided; optional local | `8080` | Render supplies the port; locally defaults to `8080` |
| `JAVA_TOOL_OPTIONS` | Docker runtime/Render optional override | `-Xmx350m -XX:+UseSerialGC` | Dockerfile default for the 512 MB memory budget |
| `SIGNED_URL_SECONDS` | Backend local/Render | `600` | Short-lived Supabase Storage signed URL lifetime |
| `TESSDATA_PATH` | Backend local/Render | `/usr/share/tesseract-ocr/5/tessdata` | Tesseract English data directory in the runtime image |
| `REMINDER_CRON` | Backend local/Render | `0 0 9 * * *` | Spring cron schedule; used only when scheduler is enabled |
| `FRONTEND_URL` | Backend local/Render | `http://localhost:5173` | Frontend base URL used to build household invite links |
| `INVITE_EXPIRY_DAYS` | Backend local/Render | `7` | Number of days until a household invitation expires |
| `VITE_SUPABASE_URL` | Frontend local/Vercel | `https://<project-ref>.supabase.co` | Supabase Project URL; public |
| `VITE_SUPABASE_ANON_KEY` | Frontend local/Vercel | `<anon-public-key>` | Supabase **Project Settings > API > anon/public**; public |
| `VITE_API_BASE_URL` | Frontend local/Vercel | `http://localhost:8080/api` | Local API URL or deployed Render URL ending in `/api` |
| `BACKEND_BASE_URL` | GitHub Actions secrets, only if using reminders workflow | `https://<render-service>.onrender.com` | Render service's public URL, without `/api` |
