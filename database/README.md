# Database

This directory contains the transitional JSON database and its import tooling.
The application reads these fixtures through a backend repository—not directly
from frontend code. Supabase migrations use the CLI-standard `supabase/migrations/`
directory.

```
database/
  fixtures/            # synthetic, database-shaped JSON tables
  scripts/
    import-json-to-supabase.mjs
supabase/
  config.toml
  migrations/          # version-controlled PostgreSQL schema
```

Generate/reset the synthetic files with:

```sh
npm run fixtures:generate
```

The backend defaults to `KAMBARU_DATA_SOURCE=mock`. After creating a Supabase
project, apply the migration and import fixtures:

```sh
supabase link --project-ref YOUR_PROJECT_REF
npm run supabase:push
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run supabase:import-fixtures
```

Then set `KAMBARU_DATA_SOURCE=supabase`. The service-role key is server-only and
must never use a `NEXT_PUBLIC_` prefix.
