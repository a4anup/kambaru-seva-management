# Kambaru Seva Management

Administrative platform for **Shree Durgaparameshwari Temple Kambar** to manage
devotees, annual **Shashwatha Pooja** enrollments, prasada dispatch, courier
address labels, reports, and daily temple operations.

Today this workflow lives in a paper diary — one page per calendar date, with
devotee details handwritten underneath. Staff have to find the right page,
read handwriting, and retype names/phones/addresses every morning to prepare
courier labels. This app replaces that process: staff enter devotee and pooja
information once, and the app reliably surfaces who is due each day and
produces print-ready courier labels — with no re-entry required in future
years.

See [`docs/PLAN.md`](./docs/PLAN.md) for the full product requirements and design,
[`docs/BACKEND_PLAN.md`](./docs/BACKEND_PLAN.md) for the executable backend
delivery plan, and [`AGENTS.md`](./AGENTS.md) for engineering conventions.

## Stack

- **Frontend** — Next.js (App Router), React 19, TypeScript, Tailwind CSS —
  [`frontend/`](./frontend)
- **Backend** — Domain services and repository layer, TypeScript —
  [`backend/`](./backend)
- **Database and Auth** — Supabase Postgres, Auth, RLS, and SQL migrations —
  [`supabase/`](./supabase)

The deployed architecture uses Supabase as its runtime database. The backend calls
tables directly for ordinary reads and PostgreSQL RPC functions for transactional
workflows. Edge Functions are reserved for schedules, webhooks, notifications, and
external integrations.

## Getting started

```sh
npm install
cp .env.example frontend/.env
npm run dev
```

Note: the env file must live in `frontend/`, not the repo root — Next.js loads
`.env` relative to where `next dev`/`next build` actually runs (the frontend
workspace), not the monorepo root.

Supabase is the only runtime data source; there is intentionally no JSON or
in-memory fallback. Setup is documented in
[`backend/README.md`](./backend/README.md).

### Useful scripts

| Command                            | Description                                      |
| ----------------------------------- | ------------------------------------------------ |
| `npm run dev`                       | Run the frontend in development mode             |
| `npm run build`                     | Build the frontend for production                |
| `npm run start`                     | Start the production build                       |
| `npm run lint`                      | Lint the frontend                                |
| `npm run typecheck`                 | Type-check frontend and backend                  |
| `npm run supabase:start`            | Start the local Supabase stack                   |
| `npm run supabase:reset`            | Reset the local Supabase database                |
| `npm run supabase:push`             | Apply migrations to the linked Supabase project  |

## Project structure

```
frontend/    Next.js application (pages, components, styles)
backend/     Trusted domain services and Supabase repository layer
supabase/    Supabase project config, SQL migrations, RLS, and Edge Functions
infra/       Infrastructure notes
docs/        PLAN.md (product/architecture) and BACKEND_PLAN.md (delivery plan)
AGENTS.md    Engineering conventions
```

## Status

Early development — see `docs/PLAN.md` for current scope and progress.
