# Legacy parity matrix

## P13 prompt deviations

- P13 advances directly beyond prior phases and records this repair/structure pass here rather than waiting for the phase numbers in section 8.
- P13 database verification could not run locally until Supabase Docker services are started.
- P13B preserves the existing household switcher selection behavior in the Warranties header rather than the removed top bar.

This matrix records the legacy backend routes, frontend surfaces, and tested business
behaviour against the React + Supabase replacement. “Replaced” means the old HTTP
endpoint is intentionally gone because Supabase client access, RLS, RPCs, or an Edge
Function now owns the operation.

## Backend routes

| Legacy route | Replacement | Evidence |
| --- | --- | --- |
| `GET /api/health` | Not needed: the deployed app is a static Vite site and Supabase owns the data plane health surface. | `vercel.json`; Supabase deployment checks |
| `GET /api/items` | Replaced by direct `items` query through `supabase-js`, scoped by RLS. | `src/features/items/ItemsPage.tsx`; `supabase/tests/rls_and_invites.test.sql` |
| `GET /api/items/{id}` | Replaced by direct item query through `supabase-js`, scoped by RLS. | `src/features/items/ItemsPage.tsx`; RLS tests |
| `POST /api/items` JSON | Replaced by direct `items` insert after the three-step form validates. | `src/features/items/AddItemPage.tsx`; `src/features/items/item-schemas.test.ts` |
| `POST /api/items` multipart | Replaced by signed Cloudinary upload followed by an RLS item insert; failed inserts clean up the upload. | `src/features/receipts/receipt-storage.ts`; `src/features/items/AddItemPage.tsx` |
| `PUT /api/items/{id}` | Replaced by direct RLS-protected item update in the edit sheet. | `src/features/items/ItemsPage.tsx`; item schema tests |
| `DELETE /api/items/{id}` | Replaced by RLS item delete followed by best-effort `receipt-delete`. | `src/features/items/ItemsPage.tsx`; `supabase/functions/receipt-delete` |
| `GET /api/items/dashboard` | Replaced by client-side mutually exclusive status bucketing and sorted Drawer sections. | `src/lib/dates/warranty.ts`; `src/features/items/ItemsPage.tsx`; `src/lib/dates/warranty.test.ts` |
| `POST /api/items/ocr` | Replaced by browser-side PDF.js/Tesseract pipeline with no upload before save. | `src/lib/ocr/receipt-ocr.ts`; `src/lib/ocr/parser.ts`; OCR tests |
| `POST /api/items/{id}/bill` | Replaced by receipt replacement on the item record and Cloudinary authenticated storage. | `src/features/items/ItemsPage.tsx`; `src/features/receipts/receipt-storage.ts` |
| `GET /api/items/{id}/bill-url` | Replaced by `cloudinary-url` Edge Function returning a short-lived URL after an RLS item check. | `supabase/functions/cloudinary-url`; `src/features/receipts/receipt-storage.ts` |
| `GET /api/items/{id}/claim-pack` | Replaced by browser-generated `pdf-lib` claim packs with embedded receipt pages. | `src/features/claim/claim-pack.ts`; `src/features/claim/claim-pack.test.ts` |
| `POST /api/households` | Replaced by atomic `create_household(name)` RPC. | `supabase/migrations`; `src/features/households/HouseholdPage.tsx` |
| `GET /api/households` | Replaced by direct RLS-protected household query. | `src/app/AppShell.tsx`; RLS tests |
| `GET /api/households/{id}/members` | Replaced by household member/profile queries protected by membership RLS. | `src/features/households/HouseholdPage.tsx`; RLS tests |
| `POST /api/households/{id}/invites` | Replaced by `invite-member` Edge Function, which inserts through RLS and sends Brevo mail. | `supabase/functions/invite-member`; invite tests |
| `POST /api/households/invites/accept` | Replaced by `accept_invite(invite_id)` RPC; verified email, expiry, and single-use rules remain enforced. | `supabase/migrations`; `src/features/households/InvitesPage.tsx`; RLS tests |
| `GET /api/bills` | Intentionally dropped: the unused `bill` model is gone and items own receipt metadata. | `supabase/migrations`; `docs/REBIRTH_SPEC.md` BR9 |
| `POST /api/households/{id}/bills` | Replaced by item-owned receipt upload. | Receipt storage tests and item flow |
| `GET /api/bills/{id}` | Intentionally dropped with the unused `bill` model. | `supabase/migrations` |
| `GET /api/bills/{id}/signed-url` | Replaced by item receipt URL lookup through `cloudinary-url`. | `supabase/functions/cloudinary-url` |
| `GET /api/bills/{id}/claim-pack` | Replaced by item claim-pack generation. | `src/features/claim/claim-pack.ts` |
| `POST /api/internal/run-reminders` | Replaced by JWT-disabled `send-reminders` Edge Function authenticated with `x-cron-secret`; pg_cron invokes it daily. | `supabase/functions/send-reminders`; `docs/OPERATIONS.md`; reminder tests |

## Frontend surfaces

| Legacy surface | Replacement | Evidence |
| --- | --- | --- |
| Login and session guard | Supabase email/password, Google OAuth, PKCE reset flow, protected React Router shell. | `src/features/auth`; `src/app/AuthProvider.tsx`; auth tests |
| Dashboard | Drawer at `/` with attention-first sorting, search, filters, categories, and master-detail layout. | `src/features/items/ItemsPage.tsx`; `src/app/App.tsx` |
| Add item | Three-step capture/review/coverage flow with draft persistence and live expiry preview. | `src/features/items/AddItemPage.tsx`; item schema/date tests |
| Item details | Coverage timeline, status stamp, receipt viewer, edit sheet, delete dialog, and claim-pack action. | `src/features/items/ItemsPage.tsx`; claim-pack tests |
| Household page | Household creation, member roles, invite/revoke/resend, remove member, owner delete, and member leave rules. | `src/features/households/HouseholdPage.tsx`; household schema/RLS tests |
| Accept invite page | `/invites` pending invite list with one-tap accept/decline and Drawer banner. | `src/features/households/InvitesPage.tsx`; RLS tests |
| Theme context and glass design showcase | Thermal-paper design tokens, light/dark theme provider, Slip/Stamp components, and dev-only `/design`. | `src/styles`; `src/components/ReceiptSlip.tsx`; `src/components/StatusStamp.tsx`; contrast test |
| Receipt upload and preview | Magic-byte validation, Cloudinary signed storage, PDF.js mobile-friendly preview, and optional receipts. | `src/features/receipts`; receipt validation tests |
| OCR | Offline browser pipeline with image downscaling/grayscale, PDF text threshold, parser confidence, and ambiguous-date markers. | `src/lib/ocr`; OCR tests |

## Business rules and defects addressed

| Legacy behaviour | New result | Test/evidence |
| --- | --- | --- |
| Calendar-month expiry with month-end clamping | Preserved in Postgres and TypeScript. | `src/lib/dates/warranty.test.ts`; migration tests |
| Overlapping active/expiring dashboard counts | Corrected to mutually exclusive expired, expiring, and active buckets. | `src/lib/dates/warranty.test.ts` |
| Extension-only receipt validation | Corrected to PDF/JPEG/PNG magic-byte validation, 5 MB cap, and filename sanitization. | `src/features/receipts/receipt-validation.test.ts` |
| Receipt forced by old UI | Receipt is optional at save time and can be added/replaced later. | Add-item flow and receipt storage |
| One reminder per item and recipient | Corrected to one digest per opted-in user per run. | `supabase/functions/send-reminders/reminder_test.ts` |
| Check-then-send reminder dedupe | Corrected to insert-first `ON CONFLICT DO NOTHING`, deleting claims on send failure. | `supabase/functions/send-reminders/reminder-core.ts`; reminder tests |
| Server-timezone reminder dates | Corrected to `APP_TIMEZONE`; cron defaults to 03:30 UTC. | `supabase/functions/send-reminders/reminder-core.ts`; `docs/OPERATIONS.md` |
| Merchant stored in notes | Dedicated `merchant` column, plus serial number and currency. | `supabase/migrations`; item form |
| Claim pack printed only storage path | Receipt bytes are embedded as image pages or merged PDF pages. | `src/features/claim/claim-pack.test.ts` |
| Ambiguous OCR dates guessed silently | Review UI marks ambiguous dates for confirmation. | `src/lib/ocr/parser.test.ts`; item review flow |
| Inline PDF iframe on mobile | PDF.js renders the preview and offers an external viewer action. | Receipt viewer implementation |
| Missing password reset/settings/removal/leave/revoke/opt-out | Reset, settings, member management, invite management, and reminder preference are implemented. | `src/features/auth`; household/settings pages; RLS tests |

## Verification status

- Application phase gates pass: typecheck, lint, 61 Vitest tests, and production build.
- Deno unit tests for invite, Cloudinary signing, and reminder logic pass.
- Supabase pgTAP tests are present but were not executable in this environment because Docker/Postgres was unavailable at `127.0.0.1:54322`.
- Android and iOS Capacitor projects are scaffolded; Android is the supported first target, while iOS remains untested on Linux.
- Legacy files remain intentionally for reference. Cleanup is pending explicit approval.
