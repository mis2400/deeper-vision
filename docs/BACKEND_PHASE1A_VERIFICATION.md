# Backend Phase 1A — verification record

Tracks acceptance for each sub pass. Updated as work lands.

## BF1A.0 — Human setup handoff (DONE)
- Supabase project created in dashboard.
- Project URL + publishable key pasted into chat by the owner.
- Stored as `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in
  `/Users/mis/Projects/deeper-vision/.env.local` (gitignored,
  confirmed via `git check-ignore -v .env.local`).
- Service role / secret key not requested, not pasted, not stored.

## BF1A.1 — Supabase client setup (DONE)
- `@supabase/supabase-js@^2.106.1` installed.
- `src/app/lib/supabaseClient.ts` exports the shared `supabase`
  client, a `supabaseConfigured` boolean for honest UI gating, and
  a `checkSupabaseHealth()` helper.
- Live health probe returns `200`. Settings endpoint returns the
  auth providers JSON via the publishable key. Client transport
  confirmed.
- `npm run build` exits 0.

## BF1A.2 — Auth + tenancy schema (APPLIED to live)
Three tables confirmed in the Supabase Table Editor:
- `profiles` — id, display_name, email, avatar_url, user_type,
  created_at, updated_at. `handle_new_user` trigger on `auth.users`
  insert auto creates the matching row.
- `organizations` — id, name, slug (unique), created_at, created_by.
- `organization_members` — id, organization_id, user_id, org_role,
  created_at. Unique (organization_id, user_id). Hot path indexes
  on each FK.

Schema plan: `docs/BACKEND_SCHEMA_PLAN.md` maps every existing
Zustand slice to its Phase 1B Postgres table including the future
`project_members` table for the eight CoWork per project roles.

## BF1A.3 — Row Level Security (APPLIED to live)
- `is_org_member`, `is_org_admin`, `is_org_owner` SECURITY DEFINER
  helpers added. Revoked from `public`, granted to `authenticated`.
- profiles: read own, update own. Insert via trigger; delete
  cascades from auth.users.
- organizations: select when member; insert open to authenticated
  with created_by = auth.uid(); update by admin / owner; delete by
  owner only.
- organization_members: select when member of the same org; insert
  via two paths (bootstrap brand-new-org-self-as-owner OR existing
  admin / owner adds someone — see BF1A security patches below for
  the tightened bootstrap predicate); update / delete by admin /
  owner of the org.

Cross org isolation test: DEFERRED. The clean test plan needs two
real signups via Supabase Auth + the `accept_invite` flow on the
second user. Two prerequisites pending before that runs:
1. The "Confirm email" toggle in Supabase Auth → Sign In / Up
   must report `mailer_autoconfirm: true` via the settings endpoint
   (currently still `false`; the dashboard toggle didn't land or
   was a different setting).
2. The 4/hour signup email rate limit must reset (chewed up while
   probing).
Once both clear, the test plan below runs against the live project.

## BF1A.4 — Login screen wired to real Supabase Auth (DONE)
- Email + password sign in via `supabase.auth.signInWithPassword`.
- Sign up via `supabase.auth.signUp` with `display_name` in
  `options.data` so the `handle_new_user` trigger picks it up.
- Real errors surfaced verbatim into the form's error chip.
- Real loading states on every async call.
- Session persistence via the supabase client's `persistSession +
  autoRefreshToken` config. Refresh on an authed session keeps the
  operator signed in.
- Honest deferrals (HIDDEN, not stubbed): SSO row (Google / MS /
  SAML), forgot password (no SMTP), demo one click button.
- "Check your email" state after sign up when email confirmation
  is required.
- Adds onAuthStateChange listener for cross tab SIGNED_IN events.
- Verified live: login form renders at /login, no demo / SSO /
  forgot affordances, unauthenticated navigation to /dashboard
  bounces to /login.

## BF1A.5 — Organization create / join (DONE)
- Picked invite codes over invite by email per the brief.
- `create_organization_with_owner(org_name)` SECURITY DEFINER RPC
  creates the org + first owner membership in one transaction.
  Replaces the prior two step client flow that could leave orphan
  orgs on partial failure.
- `create_invite(org_id, role, ttl_hours)` SECURITY DEFINER RPC.
  Restricted: admins can mint `member` invites; only owners can
  mint `owner` / `admin` invites. Returns a 12 char Crockford
  base32 ish code.
- `accept_invite(invite_code)` SECURITY DEFINER RPC. Records every
  attempt in `invite_attempt_log` with a per uid rate limit of 10
  attempts per 5 minutes. Validates code is unredeemed and
  unexpired, inserts the membership, marks the invite accepted.
- `OrgGateScreen.tsx` mounts at `/org/setup`. Four UI modes:
  choose / create / join / created. Created state surfaces the
  freshly generated invite code with a copy button so the operator
  can hand it to a teammate immediately.
- `fetchMyMemberships()` helper for the gate / dashboard.

## BF1A.6 — Auth gate (DONE)
- `AuthGate.tsx` + `AuthGateLayout` wrap every internal route via
  a single parent `<Route element={<AuthGateLayout />}>`.
- Three real states + a transport error state:
    checking → no-session → no-org → ready, plus check-error
    (transport / RLS hiccup — shows inline retry rather than
    bouncing to /login which would loop).
- Subscribes to `onAuthStateChange` for SIGNED_OUT (renders
  loading frame synchronously, then routes to /login) and
  SIGNED_IN (re-runs the membership check against the new
  identity).
- AppShell "Log out" button now hits `supabase.auth.signOut()`
  instead of just navigating. The gate listener picks up the
  SIGNED_OUT event.
- SCOPE NOTE: this is purely a routing gate. The design data
  behind it (projects, devices, pathways, the whole Zustand
  store) STAYS in localStorage in Phase 1A. The gate enforces
  presence of a Supabase session + at least one membership; it
  does NOT touch any design data and does NOT block localStorage
  access. Phase 1B moves the design data to Postgres and lets
  RLS take over the real isolation.
- Verified live: unauthenticated /dashboard and /org/setup both
  redirect to /login. Build green.

## BF1A security patches (post review)

Reviewer pass surfaced 4 HIGH + multiple IMPORTANT findings. All
addressed in commit 58d49390. Patch migration
`20260521010000_phase1a_security_patches.sql` applied below.

Highlights:
- Bootstrap insert policy tightened: only the org's creator can
  claim the first owner row.
- Atomic org creation via SECURITY DEFINER RPC.
- create_invite role conferral tightened (admins can only mint
  member invites; owners can mint owner / admin).
- accept_invite brute force throttle (10 / 5min per uid).
- tg_set_updated_at locked search_path.
- AuthGate transport vs auth error distinction; cross tab
  SIGNED_IN handling; sync loading frame on SIGNED_OUT.
- LoginScreen onAuthStateChange listener.
- OrgGateScreen onAuthStateChange listener.
- AppShell dead import removed.

## How to apply migrations

Two SQL pastes total:

### Paste 1 (already done) — BF1A.0-3 foundation
Already applied per the user's confirmation in chat. Tables exist,
RLS shows green badges.

### Paste 2 (TODO) — BF1A.5 invites + security patches
Open the SQL editor at
https://supabase.com/dashboard/project/snolxhxaintjktiizvot/sql/new
and paste the combined SQL block from the deploy proposal in chat.
It covers:
1. `20260521000000_organization_invites.sql` (invites table + RPCs)
2. `20260521010000_phase1a_security_patches.sql` (RLS tighten +
   atomic org RPC + invite throttle)

## RLS isolation test (DEFERRED until prerequisites clear)

Once `mailer_autoconfirm: true` AND the email rate limit has
cleared, this test runs against the live project. The shell script
already exists in chat (the bash + curl test that signs up two
users, has each create an org, and asserts cross org reads return
nothing). The script does NOT write to `auth.users` directly — it
uses the same public signup endpoint the SPA will use.

Expected outcomes when the test runs cleanly:
- 8 assertions pass: user A sees only org A; user B sees only
  org B; cross org reads return zero rows; cross org writes are
  denied with policy violation; auto profile creation works; each
  user can only see their own profile.

## Acceptance summary
- BF1A.0 — DONE.
- BF1A.1 — DONE; live health 200, build green.
- BF1A.2 — DONE; three tables live in Supabase.
- BF1A.3 — DONE in code + applied. Clean isolation test deferred
  until autoconfirm verified + rate limit clears.
- BF1A.4 — DONE; static verification (form renders, fakes hidden,
  unauthenticated nav bounces correctly).
- BF1A.5 — DONE in code. Live end to end test deferred with the
  same prerequisites as BF1A.3.
- BF1A.6 — DONE; static verification (auth gate redirects).
- BF1A.7 — this doc + deploy proposal posted in chat.

## Cleanup of test data (run after RLS isolation test)

```sql
-- Drop any RLS test orgs + their cascading members + invites.
delete from public.organizations where slug like 'rls-test-org-%';

-- The auth.users for the test accounts can be deleted via the
-- dashboard Authentication → Users page if email confirmation
-- requires you to keep them around; they're harmless to leave.
```
