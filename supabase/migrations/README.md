# Supabase Migrations

All schema changes are tracked here as timestamped SQL files. Migrations are the **single source of truth** for the database schema. The Supabase dashboard SQL editor is never used to modify the schema — only to inspect it.

## Migration list (Phase 2A)

| File | Scope |
| ---- | ----- |
| `20260412000001_foundation.sql` | Extensions, `security` + `phi_stub` schemas, `user_role` enum, `profiles`, `coach_assignments`, security helper functions, auth signup trigger |
| `20260412000002_programs.sql` | `programs`, `program_phases`, `program_tasks`, `client_enrollments`, `client_task_status` |
| `20260412000003_protocols.sql` | `supplements`, `client_supplements`, `supplement_adherence`, `client_exercise_protocols`, `client_nutrition_targets` |
| `20260412000004_daily_logs.sql` | Self-reported daily wellness data |
| `20260412000005_wearables.sql` | `wearable_connections`, `wearable_data_points` (generic, multi-provider) |
| `20260412000006_functional_metrics.sql` | Performance benchmarks (strength, endurance, mobility, body comp) |
| `20260412000007_coaching.sql` | `coach_notes` (behavioral only), `client_check_ins` |
| `20260412000008_education.sql` | `education_articles`, `education_triggers`, `client_article_assignments` |
| `20260412000009_audit_and_notifications.sql` | Append-only `audit_log`, `notifications` |
| `20260412000010_phi_stubs.sql` | Stub tables in `phi_stub` schema — schema only, no app reads/writes in beta |
| `20260412000011_rls_policies.sql` | RLS policies for every `public` table. Default-deny posture. |

## Workflow

### Prerequisites

- **Docker Desktop** running locally (required for `supabase start`)
- **Supabase CLI** installed: `brew install supabase/tap/supabase` (macOS) or see [docs](https://supabase.com/docs/guides/cli)

### First-time local setup

```bash
# From project root
supabase start
```

This spins up local Postgres, Studio, Auth, Storage, and Inbucket (email testing) in Docker. It automatically runs every migration in order, then executes `supabase/seed.sql`. You'll get a set of local credentials printed to the terminal — save these to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Local Supabase Studio: http://localhost:54323

### Creating demo auth users (first-time only)

Seed data references users by role. Create these three auth users in Studio:

1. Go to http://localhost:54323 → Authentication → Users → Add user
2. Create each with a password of your choice:
   - `admin@optified.dev` — then in SQL editor: `update public.profiles set role = 'admin' where email = 'admin@optified.dev';`
   - `coach@optified.dev` — then: `update public.profiles set role = 'coach' where email = 'coach@optified.dev';`
   - `samantha@optified.dev` — leaves role as default `client`
3. Create the coach assignment:
   ```sql
   insert into public.coach_assignments (client_id, coach_id)
   values (
     (select id from public.profiles where email = 'samantha@optified.dev'),
     (select id from public.profiles where email = 'coach@optified.dev')
   );
   ```

### Creating a new migration

```bash
supabase migration new <descriptive_name>
# Example:
supabase migration new add_messaging_tables
```

This creates a new file in `supabase/migrations/` with the current timestamp. Write your SQL, then:

```bash
# Apply locally
supabase db reset
```

This destroys the local DB, reruns ALL migrations + seed. Fast (~5 seconds). This is the intended dev workflow.

### Promoting to staging / production

```bash
# Link to a remote project (one-time)
supabase link --project-ref <your-project-ref>

# Preview what would change
supabase db diff --linked

# Apply pending migrations
supabase db push
```

**Never run `db reset` against a linked remote project** — it destroys production data. The CLI warns, but it's worth internalizing.

### Schema changes in production

The golden rule: **all schema changes go through migrations in this folder.** No direct SQL editor use against staging/production. This guarantees:

- Every environment has an identical schema
- Every change is reviewed in a pull request
- Rollbacks are possible
- Local and production never drift

## Security model summary

All `public.*` tables have RLS enabled. Access follows three patterns via helper functions in the `security` schema:

- **Self-access:** `auth.uid() = client_id`
- **Coach-of-client access:** `security.is_coach_of(client_id)` — checks `coach_assignments`
- **Admin access:** `security.is_admin()` — always passes

The `can_access_client(_client_id)` helper composes these (self OR coach OR admin).

`phi_stub.*` tables have RLS enabled with **no policies**, meaning all access is denied except `service_role` bypass. In beta, no application code uses service_role against phi_stub tables — the repository layer has no implementations for them. The `InDevelopmentNotice` UI component renders instead.

`audit_log` is append-only at the database level (immutability trigger + RLS). Writes come from the repository layer via service_role.
