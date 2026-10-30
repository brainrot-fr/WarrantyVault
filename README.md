# WarrantyVault

WarrantyVault keeps purchase receipts, warranty dates, expiry reminders, and household item records together. Upload a JPG, PNG, or PDF receipt, review the OCR prefill, and generate a claim-pack PDF when service is needed.

## Repository layout

- `backend/` — Java 21, Spring Boot REST API, Supabase Postgres/Storage integration, OCR, email reminders, and claim-pack generation.
- `frontend/` — React + Vite app with Supabase Auth and a responsive glass UI.
- `design-system/warrantyvault/` — committed UI design source of truth.
- `design/DESIGN_NOTES.md` — design decisions used by the frontend.
- `INSTRUCTIONS.md` — beginner-friendly Supabase, OAuth, SMTP, local run, and deployment guide.

## Quick start

1. Follow [INSTRUCTIONS.md](./INSTRUCTIONS.md) to create the Supabase project and configure SMTP.
2. Copy and fill in `backend/.env.example` and `frontend/.env.example`.
3. Start the API with `cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local`.
4. Start the UI with `cd frontend && npm install && npm run dev`.

The backend listens on port `8080`; Vite serves the frontend at `http://localhost:5173`. Do not put the Supabase service-role key in the frontend.

## Validation

- Backend: `cd backend && mvn test`
- Frontend: `cd frontend && npm ci && npm run build`

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for environment-variable values, Google login setup, reminders, troubleshooting, and deployment details.
