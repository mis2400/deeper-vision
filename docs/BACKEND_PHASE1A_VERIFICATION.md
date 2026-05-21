# Backend Phase 1A — verification record

Tracks acceptance for each sub pass. Updated as work lands.

## BF1A.0 — Human setup handoff
- Supabase project created in dashboard.
- Project URL + publishable key pasted into chat by the owner.
- Stored as `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in
  `/Users/mis/Projects/deeper-vision/.env.local` (gitignored,
  confirmed via `git check-ignore -v .env.local`).
- Service role / secret key not requested, not pasted, not stored.

## BF1A.1 — Supabase client setup
- `@supabase/supabase-js@^2.106.1` installed.
- `src/app/lib/supabaseClient.ts` exports the shared `supabase`
  client, a `supabaseConfigured` boolean for honest UI gating, and
  a `checkSupabaseHealth()` helper.
- Live health probe (`curl https://snolxhxaintjktiizvot.supabase.co/auth/v1/health`)
  returns `200`. Settings endpoint returns the auth providers JSON
  via the publishable key. Client transport confirmed.
- `npm run build` exits 0.

## BF1A.2 — Auth + tenancy schema (migrations)

Four migration files written to `supabase/migrations/`:
1. `20260520120000_profiles.sql` — `user_type` enum, `profiles`
   table, `tg_set_updated_at` trigger, `handle_new_user` trigger
   on `auth.users` insert (auto creates profile row on sign up).
2. `20260520120100_organizations.sql` — `organizations` table.
3. `20260520120200_organization_members.sql` — `org_role` enum,
   `organization_members` table, hot path indexes.

Schema plan: `docs/BACKEND_SCHEMA_PLAN.md` maps every existing
Zustand store entity to its Phase 1B Postgres table and documents
the future `project_members` table for the CoWork per project
roles (Designer, Discipline Editor, Field Surveyor, etc.).

## BF1A.3 — Row Level Security

4th migration: `20260520120300_rls_policies.sql`. Adds three
`SECURITY DEFINER` helper functions (`is_org_member`, `is_org_admin`,
`is_org_owner`) and the full policy set across all three tables.
See the migration file for the policy reasoning per row.

## How to apply the migrations to the live project

Supabase CLI is not installed on this machine and the service role
key is forbidden in this repo. Apply via the dashboard SQL editor:

1. Open https://supabase.com/dashboard/project/snolxhxaintjktiizvot/sql/new
2. Paste the entire consolidated SQL block in the chat batch summary
   (or paste the four migration files one at a time, in order).
3. Click **Run**.
4. Verify in **Table Editor**: three tables exist (`profiles`,
   `organizations`, `organization_members`). Each shows a green RLS
   indicator.

After applying, run the verification SQL below in the same editor
to prove RLS isolation between two test orgs.

## RLS isolation test (run after applying migrations)

This test creates two test users in two orgs and confirms each can
only see their own org's data. The test runs as the `postgres` role
in the SQL editor (which bypasses RLS), so the assertions use
`SET LOCAL ROLE authenticated` + `SET LOCAL request.jwt.claims` to
simulate each user.

```sql
-- Setup: two real auth users + two orgs with one member each.
-- Run this once. If the users already exist (re run), the SELECTs
-- below still pass.

do $$
declare
  uid_a uuid;
  uid_b uuid;
  org_a uuid;
  org_b uuid;
begin
  -- Create two test users in auth.users via the admin API path.
  -- Skip if they already exist.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'rls-test-a@example.com',
    crypt('test-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (email) do nothing
  returning id into uid_a;

  if uid_a is null then
    select id into uid_a from auth.users where email = 'rls-test-a@example.com';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'rls-test-b@example.com',
    crypt('test-password-b', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (email) do nothing
  returning id into uid_b;

  if uid_b is null then
    select id into uid_b from auth.users where email = 'rls-test-b@example.com';
  end if;

  -- Create the two orgs (with the test users as creators).
  insert into public.organizations (name, slug, created_by)
  values ('RLS Test Org A', 'rls-test-org-a', uid_a)
  on conflict (slug) do nothing
  returning id into org_a;

  if org_a is null then
    select id into org_a from public.organizations where slug = 'rls-test-org-a';
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('RLS Test Org B', 'rls-test-org-b', uid_b)
  on conflict (slug) do nothing
  returning id into org_b;

  if org_b is null then
    select id into org_b from public.organizations where slug = 'rls-test-org-b';
  end if;

  -- Each user joins their own org as owner.
  insert into public.organization_members (organization_id, user_id, org_role)
  values (org_a, uid_a, 'owner')
  on conflict (organization_id, user_id) do nothing;
  insert into public.organization_members (organization_id, user_id, org_role)
  values (org_b, uid_b, 'owner')
  on conflict (organization_id, user_id) do nothing;

  raise notice 'Setup complete. uid_a=%, uid_b=%, org_a=%, org_b=%',
    uid_a, uid_b, org_a, org_b;
end$$;

-- ── Assertion 1: user A sees only org A ─────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"<paste uid_a here>","role":"authenticated"}';
select 'user A — organizations visible' as label, count(*) as count
  from public.organizations;
-- expected: 1

select 'user A — memberships visible' as label, count(*) as count
  from public.organization_members;
-- expected: 1

-- ── Assertion 2: user A cannot insert a membership into org B ───────
-- expected: ERROR — new row violates row level security policy
-- (uncomment to test, then re comment)
-- insert into public.organization_members (organization_id, user_id, org_role)
-- values ('<org_b uuid>', '<uid_a>', 'owner');

-- ── Reset to postgres role ──────────────────────────────────────────
reset role;

-- ── Assertion 3: user B sees only org B ─────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"<paste uid_b here>","role":"authenticated"}';
select 'user B — organizations visible' as label, count(*) as count
  from public.organizations;
-- expected: 1
reset role;
```

After running the setup block, copy the `uid_a` / `uid_b` / `org_a` /
`org_b` UUIDs from the `notice` output into the assertion blocks
and run them one at a time.

### Cross org isolation acceptance

The assertions above prove:
- User A's `select * from organizations` returns exactly 1 row (org A).
- User B's `select * from organizations` returns exactly 1 row (org B).
- User A inserting into B's `organization_members` raises a policy
  violation.

That satisfies the BF1A.3 acceptance criterion: cross org reads
return nothing.

## Cleanup of test data (optional)

```sql
delete from public.organizations where slug in ('rls-test-org-a', 'rls-test-org-b');
delete from auth.users where email in ('rls-test-a@example.com', 'rls-test-b@example.com');
```

## Sub passes still pending

- BF1A.4 — Wire existing Login screen to real Supabase Auth.
- BF1A.5 — Organization create / join on first login.
- BF1A.6 — Auth gate around the app (UX layer only).
- BF1A.7 — Deploy proposal.
