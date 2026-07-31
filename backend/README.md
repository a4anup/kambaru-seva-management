# Backend data source

Application pages call `DevoteeService` and `EnrollmentService`. Those services use
the `TempleRepository` boundary and do not import fixture generators or database
clients.

## JSON mode (default)

```sh
KAMBARU_DATA_SOURCE=mock npm run dev
```

This reads the synthetic table-shaped files in `database/fixtures/`. Regenerate
them with `npm run fixtures:generate`.

## Supabase mode

1. Create a Supabase project.
2. Link the CLI: `supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply schema: `npm run supabase:push`.
4. Import synthetic fixtures:

   ```sh
   SUPABASE_URL=... \
   SUPABASE_SERVICE_ROLE_KEY=... \
   npm run supabase:import-fixtures
   ```

5. Configure the Next.js server:

   ```sh
   KAMBARU_DATA_SOURCE=supabase
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

The service-role key is intentionally consumed only by server-side repository
code. Never expose it as a `NEXT_PUBLIC_` variable. Supabase Auth and actor-scoped
server clients are the next backend slice before production use.
