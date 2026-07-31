# Backend data source

Application pages call `DevoteeService` and `EnrollmentService`. Those services use
the `TempleRepository` boundary and do not import database clients.

There is no JSON or in-memory runtime fallback. Every request uses an authenticated,
actor-scoped Supabase repository.

## Supabase setup

1. Create a Supabase project.
2. Link the CLI: `supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply schema: `npm run supabase:push`.
4. Configure the Next.js application:

   ```sh
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## First development staff account

Create the user in Supabase Authentication with a `display_name` user metadata
value. New accounts are deliberately inactive. Activate the first development
administrator from the Supabase SQL editor:

```sql
update public.staff_profiles
set is_active = true, deactivated_at = null
where user_id = (
  select id from auth.users where email = 'your-development-email@example.com'
);
```

Account activation is intentionally not a public browser action.

The application runtime uses the signed-in staff member's access token, with RLS
and audited RPC mutations.
