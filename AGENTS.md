# AGENTS.md

## Cursor Cloud specific instructions

Bluminoo Studio (repo/Vercel project name: `fakeit`) is a single Next.js 14 App Router
app (TypeScript + Tailwind). There is one service — the Next.js dev server — plus a
local Supabase stack used for auth, credits and gallery. Standard scripts live in
`package.json` (`npm run dev` / `build` / `lint` / `start`); see also `README.md`.

### Services / how to run

- Web app (only service): `npm run dev` → http://localhost:3000. `npm run build`,
  `npm run lint`, `npm run start` behave as documented in `package.json` / `README.md`.
- Local Supabase (auth + Postgres + storage): required for several pages to work.
  It is started via the Supabase CLI, which needs a running Docker daemon.

### Non-obvious gotchas

- The home page (`/`) renders without any env vars, but `/tarifs`, `/compte` and
  `/galerie` are Server Components that call the Supabase client at request time. With
  no Supabase env set, `/tarifs` returns **500** and `/compte` / `/galerie` behave as
  unauthenticated. So a "working" dev environment needs `.env.local` with Supabase
  values populated (see below).
- Env is read from `.env.local` (gitignored). Supabase values come from the local
  stack; the AI/billing keys are intentionally blank because they need external paid
  accounts (see "External API keys").
- **Local Supabase RLS grant gap (important):** the migrations define RLS `SELECT`
  policies (e.g. read own `profiles` row) but rely on the base table grant that hosted
  Supabase gives the `authenticated`/`anon` roles by default. Some local Postgres
  images do *not* grant `SELECT` to those roles, so RLS-protected reads fail with
  `permission denied for table profiles` and the account page shows
  "Impossible de charger ton solde…" instead of the credit balance. This repo ships
  `supabase/seed.sql` (runs automatically on `supabase start` / `supabase db reset`)
  that restores those grants, matching hosted Supabase. Do not "fix" this in the
  migrations — it is a local-vs-hosted parity issue, not an app bug.
- Restart `npm run dev` after editing `.env.local`; Next.js only reads env at startup.
- New signups start with **0 credits** (the `handle_new_user` trigger inserts
  `credits = 0`). Image/video generation costs credits, so a brand-new account cannot
  generate until credits are granted (normally via the Stripe webhook).

### Bringing up the local Supabase stack (per fresh VM)

The Supabase CLI (`supabase`) and Docker are installed in the environment, but the
Docker daemon and the Supabase containers are not running processes on a fresh boot,
so start them each session:

```bash
sudo bash -c 'nohup dockerd > /var/log/dockerd.log 2>&1 &'   # start Docker daemon
sudo chmod 666 /var/run/docker.sock                          # let the ubuntu user talk to Docker
cd /workspace && supabase start                              # boots Postgres/Auth/etc + applies migrations + seed.sql
```

`.env.local` at the repo root holds the local Supabase URL/keys plus blank AI/billing
keys. If it is missing, recreate it: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
and use the `anon` / `service_role` keys from `supabase status` for
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (these are deterministic
for the local stack). Studio UI: http://127.0.0.1:54323. Inspect the DB directly with
`docker exec supabase_db_workspace psql -U postgres -d postgres`.

### External API keys (needed only for generation / billing)

The UI runs fully without these, but the corresponding actions return a clear error
until real keys are provided (server-side only):

- `GEMINI_API_KEY` — image generation (`/api/generate`).
- `KIE_API_KEY` — video generation + uploads (`/api/generate-video`, `/api/kie/upload`).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` — subscriptions/credits.

### Verified during setup

`npm run lint`, `npm run build`, and `npm run dev` all pass. End-to-end account signup
(`/inscription` → `/compte`) works against the local Supabase stack and correctly shows
a 0-credit balance.
