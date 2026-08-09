# Infra

Deployment and operational concerns, kept separate from application code. Per
`PLAN.md` §9/§11, most of this arrives with **phase 1b** (backend wiring) and
later — nothing here should be built ahead of the need it serves.

## Hosting (PLAN.md §9.2, §9.4)

- **Frontend**: Vercel (free/hobby tier), auto-deploys `frontend/` on every push
  to `main` via Vercel's GitHub integration — this is the "automation" piece for
  deployment, and needs no files in this repo beyond pointing Vercel's project
  root at `frontend/`.
- **Database + Auth**: Supabase (free tier) — see `PLAN.md` §9.4 for the explicit
  backup/pause tradeoff of staying on the free tier.

## Node.js runtime

- Development, CI, and Vercel must use **Node.js 22 LTS**. The root and frontend
  `.nvmrc` files plus package `engines` declarations are the version source of
  truth.
- With `nvm`, run `nvm install 22 && nvm use 22` before installing dependencies.
- Set the Vercel project Node.js version to 22 if it does not automatically honor
  the frontend package engine. Reinstall dependencies and rebuild after changing
  runtime versions.

## CI

GitHub Actions workflows must live at the repo root (`.github/workflows/`, a
GitHub requirement — they can't be relocated under `infra/`). This folder is
where supporting scripts/config for those workflows belong instead, along with
notes on what the workflow does, e.g.:

- `lint/typecheck` on every PR (`npm run lint`, `npm run build` from repo root,
  which delegate into the `@kambaru/frontend` workspace).

## Backups (PLAN.md §9.4)

The free Supabase tier does not include automated daily backups. Plan: a weekly
scheduled `pg_dump` (e.g. a GitHub Actions cron) exporting to a private storage
location, so there's at least one restorable copy outside Supabase itself. Add
the actual script/workflow here once the Supabase development environment is
connected and restore testing can be automated.

## Environment variables

An `.env.example` (documenting `DATABASE_URL`, Supabase keys, etc. without real
values) belongs here once phase 1b introduces them. Never commit a real `.env`
— see `AGENTS.md` security rules.
