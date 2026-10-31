# WarrantyVault repository instructions

- Read `docs/REBIRTH_SPEC.md` before any task.
- Build the React + TypeScript app with Vite; TypeScript strict mode is required.
- Use React Router, TanStack Query, supabase-js, React Hook Form, Zod, date-fns, Tailwind, shadcn/ui, and Vitest.
- Use Supabase Postgres and RLS for authorization. Do not add a custom REST backend.
- Keep UI strings in `src/lib/copy.ts`; use “household” consistently.
- UI follows docs/FIX_SPEC.md §C; rem-based sizing; no fixed px for text-bearing boxes.
- Follow the specification’s phase order, business rules, accessibility, and visual design.
- Never include secrets in source or commits. Keep local secrets in ignored `.env.local`.
- Preserve unrelated work and never use destructive Git operations or modify `main`.
- Prefer existing project patterns; make focused changes and test the behavior being changed.
- Use Conventional Commits for phase commits.

## Commands

- `npm run dev` — start the Vite development server.
- `npm run typecheck` — run the TypeScript checks.
- `npm run lint` — run ESLint.
- `npm test` — run the Vitest suite.
- `npm run build` — create the production build.
- `npm run db:test` — run Supabase pgTAP database tests (requires local Supabase services).
- Phase gate: `npm run typecheck && npm run lint && npm test && npm run build`.
