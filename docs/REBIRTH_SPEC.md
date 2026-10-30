# REBIRTH: rewrite WarrantyVault as React + Supabase + Cloudinary + Capacitor

## 0. Protocol (follow strictly)
- Use agent mode. Execute phases in order (section 8). After each phase: run the gate
  (`npm run typecheck && npm run lint && npm test && npm run build`, plus Supabase DB tests where relevant),
  commit with Conventional Commits, print a report of at most 10 lines (done / deviations / open questions),
  then STOP and wait for me to say "continue".
- Never touch `main`. Never force-push, rebase, or `reset --hard`. All work stays on `rebirth`.
- Never invent credentials, package names or API signatures. Check packages with `npm view <pkg> version`.
  Check current official docs (Tailwind, shadcn/ui, Supabase, Cloudinary, Brevo, Capacitor) before using an API.
  If docs contradict this spec, follow the docs and report the deviation.
- When you need a value from me (section 9), stop and ask. Secrets live only in `.env.local` (git-ignored),
  Supabase secrets, and Vercel env. Never put them in source or commits.
- The legacy code is the spec for business logic. Read the cited legacy file before porting a rule.
  Port behaviour, not structure.
- FIRST ACTIONS, in order:
  1. `git switch -c rebirth`
  2. Save this entire prompt verbatim to `docs/REBIRTH_SPEC.md`
  3. Write `.github/copilot-instructions.md` (60 lines max): stack, conventions, commands,
     and "read docs/REBIRTH_SPEC.md before any task"
  4. Commit.

## 1. Architecture and dependency logic
There is no custom backend. The Java/Spring API is replaced by:
- Postgres + Row Level Security: all authorization.
- Supabase Auth: email/password and Google.
- Edge Functions, only where a secret is required: Cloudinary signing/deletion, Brevo mail.
- pg_cron + pg_net: the daily reminder trigger.
- Browser-side OCR (tesseract.js + pdfjs-dist) and claim-pack PDF generation (pdf-lib).

Dependency order: scaffold + design system -> schema/RLS -> auth + shell -> households/invites ->
receipt storage -> OCR -> items -> claim pack -> reminders -> Capacitor -> deploy -> cleanup.

Stack: Vite + React + TypeScript (strict), React Router, TanStack Query, supabase-js,
react-hook-form + zod, date-fns, Tailwind (current major) + shadcn/ui (init with `npx shadcn@latest init`),
sonner, lucide-react, tesseract.js, pdfjs-dist, pdf-lib, Vitest + Testing Library, Capacitor.
Use the latest stable versions of everything. Data access is supabase-js directly (RLS enforces access).
Do not build a REST layer.

Repo layout (new app at repo root):
  src/{app,components/ui,components,features/{auth,items,households,receipts,claim,settings},lib/{supabase,ocr,dates,format},routes,styles}
  supabase/{migrations,functions/{_shared,cloudinary-sign,cloudinary-url,receipt-delete,invite-member,send-reminders},tests}
  legacy/   <- `git mv` of backend/, frontend/, design-system/, design/, supabase/setup.sql, render.yaml,
               INSTRUCTIONS.md, .github/workflows/* (read-only reference; deleted in phase 12)
  docs/
Leave the `ui-ux-pro-max-skill` submodule untouched until phase 12 and ask me then.

## 2. Business rules to preserve (source: legacy/backend)
BR1 Expiry = purchase_date + warranty_months in CALENDAR months, clamped to month end
    (2024-02-29 +12 -> 2025-02-28; 2025-05-31 +3 -> 2025-08-31). Source: Bill.WarrantyDates, WarrantyItem.
    Implement once in Postgres (generated column, or trigger if generated is not immutable-safe) and once in
    `lib/dates` (date-fns addMonths) so the form can preview it. Test both with the two cases above.
BR2 Status buckets are MUTUALLY EXCLUSIVE:
    expired = expiry < today; expiring = 0 <= days_left <= 30; active = days_left > 30 or no expiry date.
    (Legacy dashboard counted expiring items inside "active", so do not copy that.)
BR3 Receipt files: only PDF/JPEG/PNG, at most 5 MB, validated by magic bytes, not just extension/MIME
    (source: BillService.validate). The filename is sanitised to [A-Za-z0-9._-]. A receipt is optional at
    save time; the UI nudges but does not block (legacy UI forced it while the API did not).
BR4 Households: roles owner | member. Any member can create/edit/delete items in the household.
    Only the owner can remove members, revoke invites and delete the household. The owner cannot leave.
BR5 Reminders at exactly 30 and 7 days before expiry. Recipients are all household members with an email.
    Dedupe per (item, user, date). Log only after a successful send. One failed recipient never aborts the run.
    (Sources: ReminderTargetSelector, ReminderService.) Port the selector tests.
BR6 OCR parsing: port WarrantyTextParser to a pure TS function with every regex and heuristic:
    duration, day-first vs month-first dates, locale-aware price (1.234,50 vs 1,234.50), "Description of Goods"
    product block, brand = first word of product, "Billed From" merchant. Port ALL cases in
    WarrantyTextParserTest into Vitest. Extensions: also parse "warranty: 6 months" (legacy only handled years in
    that form) and return per-field confidence. A date where both day and month are <= 12 is flagged "ambiguous".
BR7 Invites: bound to an email (case-insensitive), single-use, expire after 7 days (configurable).
    Accepting requires the signed-in user's verified email to match.

## 3. Defects in the old app to fix
1. No password reset, account settings, remove-member, leave, revoke-invite or reminder opt-out -> build them.
2. One reminder email per item and per user, which burns Brevo's 300/day cap -> ONE digest email per user per run.
3. Reminder dedupe was check-then-send (race-prone) -> insert the log row first with ON CONFLICT DO NOTHING,
   send, and delete the row if sending fails.
4. Reminder "today" used the server timezone -> use APP_TIMEZONE (Intl), cron default 03:30 UTC.
5. OCR merchant was dumped into notes -> real `merchant` column. Add optional `serial_number` and `currency`.
6. Claim pack only printed the storage path -> it must embed the receipt (image page, or merged PDF pages).
7. Ambiguous OCR dates were silently guessed -> show a "check this date" marker in the review step.
8. Inline PDF iframe preview breaks on mobile -> render with pdf.js, with an "Open in viewer" action.
9. The `bill` table and Bill endpoints were unused by the UI -> drop them. Items own the receipt metadata.

## 4. Data model (Postgres, migrations in supabase/migrations)
Enable RLS on EVERY table. Make no assumptions about extensions; check what the project has.
- profiles(id uuid pk -> auth.users on delete cascade, email, display_name, email_reminders bool default true,
  created_at, updated_at). Created by a trigger on auth.users insert, with email kept in sync on update.
  This replaces the legacy UserProvisioningFilter.
- households(id, name, created_by, created_at)
- household_members(household_id, user_id, role check in ('owner','member'), joined_at, pk(household_id,user_id))
- household_invites(id, household_id, email, invited_by, status check in ('pending','accepted','revoked'),
  expires_at default now()+7 days, accepted_at, created_at).
  Partial unique index on (household_id, lower(email)) where status='pending'. No token column.
- items(id, household_id, name not null, brand, category, merchant, serial_number, purchase_date, purchase_price
  numeric(12,2), currency, warranty_months int check >=0, expiry_date (BR1), notes,
  receipt_public_id, receipt_resource_type, receipt_format, receipt_bytes, receipt_filename,
  created_by, created_at, updated_at via trigger)
- reminder_log(id, item_id -> items on delete cascade, user_id, reminder_date, days_before, sent_at,
  unique(item_id,user_id,reminder_date)). RLS on, NO client policies (service role only).
Indexes: items(household_id), items(expiry_date), household_members(user_id), plus every column used in a policy.

RLS rules:
- Use SECURITY DEFINER helpers `is_household_member(uuid)` and `is_household_owner(uuid)` with
  `set search_path = ''` to avoid policy recursion.
- Write `(select auth.uid())` in policies, not bare `auth.uid()`.
- Clients cannot insert into households or household_members directly. Use RPCs:
  `create_household(name)` (atomic: household + owner row), `accept_invite(invite_id)`, `decline_invite(invite_id)`,
  `remove_member`, `leave_household`.
- accept_invite is SECURITY DEFINER. It checks pending + not expired + lower(auth.jwt()->>'email') = lower(invite.email),
  inserts the member (idempotent), and marks the invite accepted.
- Invitee can SELECT invites addressed to their email. Members can SELECT/INSERT (invited_by = auth.uid())
  for their household. The owner can UPDATE status to 'revoked'.
- profiles: a user reads their own row plus co-members' rows (for member lists) and updates only their own.
- Write pgTAP tests (`supabase/tests`) proving: outsiders cannot read or write items; a member cannot see another
  household's data; an invite for another email cannot be accepted; expired and used invites are rejected;
  an owner cannot leave.
Generate TS types (`supabase gen types typescript`) into `src/lib/supabase/types.ts`.
Auth settings: keep "Confirm email" ON (BR7 depends on it).

## 5. Edge Functions (Deno, in supabase/functions)
Shared: `_shared/cors.ts` (origins from ALLOWED_ORIGINS, handle OPTIONS), `_shared/auth.ts` (client built from the
caller's Authorization header so RLS applies), `_shared/brevo.ts` (POST https://api.brevo.com/v3/smtp/email
with the `api-key` header). Outbound SMTP ports 25/587 are blocked on Edge Functions, so use the HTTPS API only.
- cloudinary-sign: caller must be a member of the given household (checked via the RLS client). Returns a signed
  upload payload (timestamp, signature, api_key, cloud_name, folder `warrantyvault/<household_id>`, type `authenticated`, allowed formats jpg/png/pdf). The API secret never leaves the function.
- cloudinary-url: RLS-select the item (this proves access) and return a SHORT-LIVED (about 10 min) delivery URL.
  Prefer an expiring URL (e.g. the private download URL with expires_at). If it cannot serve inline, fall back to
  a signed authenticated delivery URL and tell me the trade-off. Verify in the current Cloudinary docs.
- receipt-delete: accept {public_id, resource_type}. Verify the public_id's folder matches a household the caller
  belongs to, then destroy it. Item delete = delete row (RLS) -> best-effort receipt-delete -> log failures.
- invite-member: {household_id, email}. Insert via the RLS client, then send the invite email via Brevo.
  The link is `${APP_URL}/invites` (NO token). If sending fails, roll back the invite and return 502.
- send-reminders: deployed with JWT verification OFF, authenticated by a timing-safe compare of the
  `x-cron-secret` header. Algorithm: today = date in APP_TIMEZONE. For offset in [30, 7]: select items with
  expiry_date = today+offset, join members -> profiles (email present and email_reminders=true), group by user.
  Insert reminder_log ON CONFLICT DO NOTHING RETURNING; notify only the returned items. Send ONE digest email per
  user (subject like "2 warranties expiring soon"; each item shows name, date, days left and a link
  `${APP_URL}/items/<id>`; footer links to /settings to opt out). On send failure delete that user's
  just-inserted log rows and continue. Respect MAX_EMAILS_PER_RUN (default 250) and return JSON counts.
Schedule with pg_cron + pg_net, secret in Supabase Vault. Default 03:30 UTC, documented in docs/OPERATIONS.md.
Secrets: BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
CLOUDINARY_API_SECRET, CRON_SECRET, APP_URL, ALLOWED_ORIGINS, APP_TIMEZONE, MAX_EMAILS_PER_RUN.
Unit-test the pure logic (reminder selection and digest grouping) with Deno tests.
Also configure Supabase Auth custom SMTP to Brevo (smtp-relay.brevo.com:587). Write the dashboard steps in
docs/SETUP.md, since you cannot do that part.

## 6. Receipt, OCR and claim pack (client side)
- Validate the file (BR3) -> run OCR in a Web Worker with progress. Nothing is uploaded until the user saves.
- Images: downscale to a max long edge of about 2000px and convert to grayscale before OCR.
- PDFs: pdf.js text of page 1. If it has fewer than 20 non-whitespace chars, render page 1 and OCR it.
- Bundle tesseract `eng` traineddata under `public/tessdata` and set langPath (offline-safe for Capacitor).
  Lazy-load the OCR chunk so the first paint stays small.
- Save order: upload to Cloudinary (signed) -> insert the item. If the insert fails, call receipt-delete to clean up.
- Claim pack: generated in the browser with pdf-lib. Page 1 has the item facts (product, brand, category, merchant,
  serial, purchase date, price, warranty length, expiry) and a document reference. Then the receipt follows:
  embedded image page, or merged PDF pages. Fetch via the signed URL (confirm Cloudinary CORS). Download on web;
  Share/Filesystem on native.

## 7. UI/UX specification (the main deliverable)
Product: a household drawer of receipts and warranties. The audience is people at home. The primary job is
"when something breaks, find the proof and the coverage in under 10 seconds, and never miss an expiry".
Do NOT reuse the legacy look (warm stone + gold + Cormorant serif + glass cards + blurred blobs). It is a generic default.

Visual language: the thermal-paper receipt. Spend boldness in ONE place, the item "slip" component: a receipt-slip
card with a torn bottom edge (CSS mask), tabular mono amounts, and status shown as a stamp. Everything else is
quiet, flat, hairline-bordered, 6px radius. No glassmorphism, no gradients, no ambient blobs.
Palette (define as CSS variables, map to shadcn semantic tokens, with light and dark):
  light: paper #ECEEEB, slip #FBFBF8, ink #151A21, carbon #2447C4 (primary action), void #B3261E (expired),
         ok #1D6B47 (active), due #A86400 (expiring)
  dark:  paper #0F1318, slip #171C23, ink #E8EAE4, carbon #7C9BFF, void #FF8A80, ok #6FD3A0, due #F2B35E
  Verify every text/background pair is >= 4.5:1 programmatically (add a Vitest contrast test) and adjust if not.
Type (self-hosted via @fontsource, since no Google CDN works offline in Capacitor; verify package names exist):
  Schibsted Grotesk (UI + headings; use weight contrast 500/700/800, tight tracking on display sizes)
  IBM Plex Mono ONLY for amounts, dates, serial numbers and OCR text.
  Scale 12/14/16/20/25/31/39, 16px base on mobile, line length <= 68ch, sentence case everywhere.
Do NOT use: tracked all-caps eyebrow labels, one-accent-word headlines, numbered 01/02/03 markers,
"->" appended to buttons, hover-lift on every card, fade-slide entrance on every section, identical rounded cards
for everything, a 3-stat-card dashboard header.
Motion: only motion that answers an action (sheet open/close, optimistic updates, skeletons). One signature
moment: the status stamp lands once on the item detail screen. Honour prefers-reduced-motion.

Layout (mobile-first, left-aligned, numbers right-aligned):
- Mobile: top bar (household switcher, search) + bottom nav (Drawer | Add | Household). Honour safe-area insets.
  Touch targets >= 44px. Use Sheet/Drawer (vaul) for secondary flows.
- Desktop >= 1024px: left rail nav + master-detail Drawer (list left, selected item detail right).
- Household switcher: "All households" or one household, persisted locally.

Screens:
1. /login: email+password, Google, "Forgot password" -> /auth/reset. Simple and fast, no marketing hero.
2. Drawer (/): first section "Needs attention" = items expiring or expired, sorted by days left (the point of the app).
   Then all items with search (name/brand/merchant/serial), filter chips Active/Expiring/Expired, grouping by
   category. Slip cards show name, brand, mono price, and the stamp with days left.
   Empty state tells the user to scan their first receipt.
3. Add item (/items/new) is a 3-step flow, NOT one long form:
   Step 1 Capture: camera/photo/PDF, with a visible "Skip, enter manually".
   Step 2 Review: OCR prefill, each field with a confidence marker and an "check this date" marker for ambiguous dates.
   Step 3 Coverage: purchase date, warranty months (quick chips 6/12/24/36), LIVE expiry preview, household select, notes.
   Draft state survives navigation. Per-field zod errors.
4. Item detail: top is the coverage timeline (purchase -> today -> expiry on one rule, with the tick at today) and the
   stamp. Primary action "Download claim pack". The receipt is shown as a slip with "Replace receipt". Edit in a
   Sheet; delete via AlertDialog (names the item).
5. Household: members with roles (owner can remove), pending invites (resend, revoke), an "Invite by email" form.
   NO link or code is shown or copied anywhere.
6. /invites: pending invites for the signed-in email. Accept / Decline are one tap each. Also surface a banner on the
   Drawer when invites are pending.
7. Settings: profile, theme (system/light/dark), email reminders toggle, sign out.
8. 404 and error boundary with a recovery action.
Copy: active voice, name actions consistently (the "Save item" button -> toast "Item saved"). Errors say what
happened and how to fix it. Keep all UI strings in `src/lib/copy.ts`. The UI label is "household"; renaming it to
"space" must be a one-file change.
shadcn components to use: Button, Input, Label, Form, Select, Dialog, AlertDialog, Sheet, Drawer, Tabs, Badge,
Calendar+Popover (date), DropdownMenu, Avatar, Skeleton, Sonner, Command (switcher/search), Tooltip, Separator.
Customise them to the tokens above, never leave them at stock styling.
Quality floor: WCAG AA, visible focus rings, labelled icon buttons, aria-invalid/aria-describedby on errors,
tested at 375 / 768 / 1024 / 1440px, no horizontal scroll.

## 8. Phases (stop after each)
P1  Scaffold: move legacy/ aside; Vite+TS+Tailwind+shadcn; tokens, fonts, theme provider, `copy.ts`, the Slip and
    Stamp components, and a dev-only /design route showing every component in light and dark. Scripts: dev, build,
    typecheck, lint, test. Vitest contrast test.
P2  Supabase: `supabase init`/`link`, migrations (section 4), RLS, RPCs, pgTAP tests, generated types.
P3  Auth + app shell: sign in/up, Google, reset flow, session guard, profiles trigger verified, nav shell, switcher.
P4  Households + invites (BR4, BR7): create, members, invite-member function + Brevo, /invites, accept/decline, remove/leave/revoke.
P5  Receipt storage: cloudinary-sign/url/delete, upload hook, receipt viewer, magic-byte validation (BR3).
P6  OCR: worker pipeline, parser port with all legacy test cases (BR6), confidence flags.
P7  Items: CRUD, expiry (BR1/BR2), 3-step add flow, Drawer screen, item detail, search/filter.
P8  Claim pack (section 6).
P9  Reminders (BR5): send-reminders, pg_cron, digest email, opt-out, docs/OPERATIONS.md with a manual trigger curl.
P10 Capacitor: `@capacitor/core` + cli, Android first (iOS needs macOS/Xcode; scaffold it but mark untested).
    Ask me to confirm the appId first, since it is painful to change later. Plugins: app, browser, camera,
    filesystem, share, status-bar, splash-screen, preferences. Google OAuth with PKCE via a custom-scheme deep link
    (`@capacitor/browser` + `appUrlOpen` -> exchangeCodeForSession). Use a Preferences-backed storage adapter for
    the Supabase session. Native camera, with a web file-input fallback. Safe areas. Document `npx cap sync`/`run`
    in docs/MOBILE.md. If publishing to the App Store, note the in-app account deletion requirement and verify the rule.
P11 Deploy: vercel.json SPA rewrite, env var docs, CI (typecheck, lint, test, build, supabase db tests) replacing the old
    workflows, preview-URL redirect allow-list notes for Supabase Auth.
P12 Parity + cleanup: fill the parity matrix in docs/PARITY.md (every legacy endpoint/feature -> new
    implementation + test). Then ask me for approval before deleting legacy/, render.yaml, the old
    reminders workflow, the submodule, and before rewriting README/INSTRUCTIONS into docs/SETUP.md.

## 9. Values I will provide when you ask (never guess)
Supabase URL + publishable/anon key (verify which key names the new dashboard shows), DB password,
Cloudinary cloud name/key/secret, Brevo API key + verified sender, Vercel project URL, Google OAuth client
details, Capacitor appId, APP_TIMEZONE (e.g. Asia/Kolkata).

## 10. Definition of done
Gate passes with zero warnings. The parser tests ported from legacy pass. pgTAP RLS tests pass. A fresh clone plus
docs/SETUP.md reproduces the deployment. A second account can be invited by email only and can accept with one tap.
A manual `send-reminders` call with an item expiring in 30 days sends exactly one digest and a second call sends none.
