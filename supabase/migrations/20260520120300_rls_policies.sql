-- Backend Phase 1A — BF1A.3
-- Row Level Security on profiles / organizations / organization_members.
-- This is the REAL access boundary. Client side gating is UX only.
--
-- Predicate philosophy: every read / write on a non profile table
-- checks `auth.uid() in (select user_id from organization_members
-- where organization_id = <row>.organization_id)`. We wrap that
-- predicate behind a SECURITY DEFINER helper so policies are
-- declarative and the predicate is recursion safe (a policy on
-- organization_members cannot reference itself without infinite
-- recursion otherwise).

-- ─── helper: is the requesting user a member of this org? ───────────
-- SECURITY DEFINER lets the function bypass RLS on
-- organization_members so it can check membership without recursing
-- into the policy that's calling it. The function reads only the
-- two columns it needs and returns a boolean — no data leakage.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and org_role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and org_role = 'owner'
  );
$$;

-- Lock the helpers down so only signed in users can call them.
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid)  from public;
revoke all on function public.is_org_owner(uuid)  from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid)  to authenticated;
grant execute on function public.is_org_owner(uuid)  to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert is handled by the handle_new_user() trigger which runs as
-- security definer; no client side insert policy needed. Delete
-- cascades from auth.users; no client side delete policy needed.

-- ════════════════════════════════════════════════════════════════════
-- organizations
-- ════════════════════════════════════════════════════════════════════
alter table public.organizations enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations for select
  using (public.is_org_member(id));

-- Any authenticated user can create an org. The very next thing the
-- SPA does is insert their owner membership row (see the brand new
-- org policy below). The combination keeps creation open without
-- letting a user join an existing org by writing to organizations.
drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated
  on public.organizations for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner
  on public.organizations for delete
  using (public.is_org_owner(id));

-- ════════════════════════════════════════════════════════════════════
-- organization_members
-- ════════════════════════════════════════════════════════════════════
alter table public.organization_members enable row level security;

-- Read: a user can see all memberships for any org they belong to.
-- That includes their own membership row and their teammates'.
drop policy if exists organization_members_select_same_org
  on public.organization_members;
create policy organization_members_select_same_org
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- Insert: two cases.
--   1. A user inserting themselves as 'owner' of a brand new org —
--      the org has no existing members. This is the bootstrap path
--      for create org flows.
--   2. An owner / admin inserting another user as a member of an
--      org they administer.
drop policy if exists organization_members_insert
  on public.organization_members;
create policy organization_members_insert
  on public.organization_members for insert
  to authenticated
  with check (
    -- Case 1: bootstrap self as owner on a brand new org
    (
      user_id = auth.uid()
      and org_role = 'owner'
      and not exists (
        select 1 from public.organization_members existing
        where existing.organization_id = organization_members.organization_id
      )
    )
    or
    -- Case 2: existing admin / owner is adding someone
    public.is_org_admin(organization_id)
  );

-- Update: owners / admins can change roles within their org. A user
-- cannot escalate their own role through this policy because
-- is_org_admin checks the row that already exists, not the row being
-- written; and the with check repeats the predicate after the write.
drop policy if exists organization_members_update_admin
  on public.organization_members;
create policy organization_members_update_admin
  on public.organization_members for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Delete: owners / admins. A user removing themselves from an org
-- they're a non admin member of also goes through this — they can
-- delete only if they're admin / owner. A 'leave org' UX for
-- non admins layers later via a custom function; the bare RLS
-- predicate keeps the boundary tight.
drop policy if exists organization_members_delete_admin
  on public.organization_members;
create policy organization_members_delete_admin
  on public.organization_members for delete
  using (public.is_org_admin(organization_id));
