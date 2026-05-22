-- Backend Phase 1A — explicit table grants.
--
-- PostgREST runs every request as the role attached to the JWT
-- (anon for the publishable key alone, authenticated when a session
-- is present). The role needs a Postgres GRANT on every table it
-- touches; without it, Postgres rejects the query with error 42501
-- before RLS even runs. Supabase normally seeds these via ALTER
-- DEFAULT PRIVILEGES, but this project's defaults didn't fire on
-- the auth role for our tables, so we set them explicitly here.
--
-- IMPORTANT: this migration changes ONLY the table-level access
-- (does the role get to touch the table at all). The RLS policies
-- defined in 20260520120300_rls_policies.sql and tightened in
-- 20260521010000_phase1a_security_patches.sql continue to filter
-- which ROWS each authenticated user can see / mutate. A logged in
-- user STILL cannot read or write rows belonging to another
-- organization. Opening table-level grants does NOT open cross
-- organization data access.
--
-- Security model recap, for the record:
--   1. Postgres checks: does the role have USAGE on the schema +
--      the requested operation grant (SELECT / INSERT / UPDATE /
--      DELETE) on the table?  -> this migration grants these.
--   2. RLS policies then filter the rows the role is allowed to
--      see / mutate based on auth.uid() and org membership.  ->
--      already in place, unchanged here.
-- Without step 1, step 2 never runs. Without step 2, step 1
-- exposes everything. Both layers stay on.

grant usage on schema public to anon, authenticated;

-- profiles: read + update own (RLS: auth.uid() = id).
grant select, update on public.profiles to authenticated;

-- organizations: read when member; insert as creator; update by
-- admin / owner; delete by owner. INSERT is granted so the legacy
-- client path still works if the RPC is ever bypassed; the RLS
-- check (created_by = auth.uid()) keeps the insert path honest.
grant select, insert, update, delete on public.organizations to authenticated;

-- organization_members: select when member of the same org;
-- bootstrap insert via the tightened policy (only the org creator
-- can claim the first owner row, and only on a freshly created
-- org with no existing members); update / delete by admin / owner.
grant select, insert, update, delete on public.organization_members to authenticated;

-- organization_invites: admins read + revoke. Insert / update
-- happen only via the SECURITY DEFINER RPCs (create_invite,
-- accept_invite), which run as the function owner and do not
-- need client level grants.
grant select, delete on public.organization_invites to authenticated;

-- Tables touched only by SECURITY DEFINER functions get NO grants.
-- invite_attempt_log stays locked from every client; only
-- accept_invite (security definer) writes to it.

-- anon role gets no table grants. The unauthenticated client only
-- ever hits Supabase Auth endpoints (sign up, sign in, password
-- reset) which use auth.users via gotrue, not our public tables.
