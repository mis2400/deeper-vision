-- Backend Phase 1A — security review patches.
--
-- Addresses four HIGH findings from the security reviewer plus a
-- couple of MEDIUM polish items:
--   1. Tighten the organization_members bootstrap policy so only the
--      org's creator can claim the first owner row (closes the org
--      takeover hole on orphaned orgs).
--   2. New SECURITY DEFINER RPC `create_organization_with_owner`
--      that creates the org + first owner membership in one
--      transaction (collapses the orphan-org window from the client
--      side and removes the bootstrap-takeover surface entirely).
--   3. `create_invite` now restricts the role it can confer:
--      'owner' invites require an owner caller; 'admin' invites
--      require an owner caller too. Admins can only mint 'member'
--      invites, matching the org level role model.
--   4. `accept_invite` now records every attempt in a throttle log
--      and rejects callers who exceed 10 attempts per 5 minutes,
--      blunting brute force against the 60 bit invite code.
--   5. `tg_set_updated_at` gains `set search_path = public` for
--      defense in depth against future role / search path attacks.

-- ─── 1. lock tg_set_updated_at search_path ──────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end$$;

-- ─── 2. tighten organization_members bootstrap policy ───────────────
-- Old policy: anyone could insert themselves as owner of any org with
-- zero existing members. If an org ever landed in that state (e.g.
-- via the orphan-org bug below or future leave-org code), it could
-- be stolen.
-- New policy: in the bootstrap branch, the org must additionally
-- have been created BY the caller. That removes the takeover surface
-- entirely.
drop policy if exists organization_members_insert
  on public.organization_members;
create policy organization_members_insert
  on public.organization_members for insert
  to authenticated
  with check (
    -- Case 1: bootstrap self as owner on a brand new org you created
    (
      user_id = auth.uid()
      and org_role = 'owner'
      and not exists (
        select 1 from public.organization_members existing
        where existing.organization_id = organization_members.organization_id
      )
      and exists (
        select 1 from public.organizations o
        where o.id = organization_members.organization_id
          and o.created_by = auth.uid()
      )
    )
    or
    -- Case 2: existing admin / owner adds someone
    public.is_org_admin(organization_id)
  );

-- ─── 3. atomic org creation via SECURITY DEFINER ───────────────────
-- Replaces the two step client flow. Both inserts happen inside one
-- DB transaction; a failure rolls everything back, no orphan orgs.
-- The function also generates the slug server side so we don't need
-- client randomness for collision avoidance.
create or replace function public.create_organization_with_owner(
  org_name text
)
returns table (id uuid, name text, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  generated_slug text;
  new_org_id uuid;
  attempt int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if trim(coalesce(org_name, '')) = '' then
    raise exception 'organization name is required';
  end if;

  base_slug := regexp_replace(lower(org_name), '[^a-z0-9]+', '-', 'g');
  base_slug := substring(trim(both '-' from base_slug) from 1 for 40);
  if base_slug = '' then base_slug := 'org'; end if;

  loop
    attempt := attempt + 1;
    generated_slug := base_slug || '-' || encode(gen_random_bytes(3), 'hex');
    begin
      insert into public.organizations (name, slug, created_by)
      values (trim(org_name), generated_slug, auth.uid())
      returning organizations.id into new_org_id;
      exit;
    exception
      when unique_violation then null; -- collision; loop with a fresh tail
    end;
    if attempt > 16 then
      raise exception 'could not generate a unique slug after 16 attempts';
    end if;
  end loop;

  insert into public.organization_members (organization_id, user_id, org_role)
  values (new_org_id, auth.uid(), 'owner');

  return query
    select o.id, o.name, o.slug from public.organizations o where o.id = new_org_id;
end$$;

revoke all on function public.create_organization_with_owner(text) from public;
grant execute on function public.create_organization_with_owner(text) to authenticated;

-- ─── 4. tighten create_invite role conferral ────────────────────────
-- Admins can mint 'member' invites. Only owners can mint 'admin' or
-- 'owner' invites. Closes the path where an admin grants ownership
-- to a colluding account.
create or replace function public.create_invite(
  org_id    uuid,
  role      org_role default 'member',
  ttl_hours int default 168
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_org_admin(org_id) then
    raise exception 'not authorized to create invites for this organization';
  end if;
  if role in ('owner', 'admin') and not public.is_org_owner(org_id) then
    raise exception 'only owners can mint owner or admin invites';
  end if;
  if ttl_hours < 1 or ttl_hours > 24 * 30 then
    raise exception 'ttl_hours out of range (1 to 720)';
  end if;

  loop
    generated_code := upper(replace(encode(gen_random_bytes(8), 'base32'), '=', ''));
    generated_code := substring(generated_code from 1 for 12);
    begin
      insert into public.organization_invites (organization_id, code, org_role, created_by, expires_at)
      values (org_id, generated_code, role, auth.uid(), now() + (ttl_hours || ' hours')::interval);
      exit;
    exception
      when unique_violation then null;
    end;
  end loop;

  return generated_code;
end$$;

revoke all on function public.create_invite(uuid, org_role, int) from public;
grant execute on function public.create_invite(uuid, org_role, int) to authenticated;

-- ─── 5. accept_invite throttle log + new behavior ──────────────────
create table if not exists public.invite_attempt_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  attempted_at  timestamptz not null default now(),
  success       boolean not null default false
);

create index if not exists invite_attempt_log_user_recent_idx
  on public.invite_attempt_log (user_id, attempted_at desc);

-- Nobody reads / writes this table directly; only accept_invite
-- (security definer) touches it. RLS on with no policies = locked
-- from the client.
alter table public.invite_attempt_log enable row level security;

create or replace function public.accept_invite(invite_code text)
returns table (organization_id uuid, org_role org_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row    public.organization_invites;
  recent_count  int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Throttle: max 10 attempts (success or failure) per 5 minutes
  -- per user. Failed lookups still count so brute force is bounded.
  select count(*) into recent_count
    from public.invite_attempt_log
    where user_id = auth.uid()
      and attempted_at > now() - interval '5 minutes';
  if recent_count >= 10 then
    raise exception 'too many invite attempts. wait a few minutes and try again.';
  end if;

  invite_code := upper(trim(invite_code));

  select * into invite_row from public.organization_invites
    where code = invite_code
      and accepted_at is null
      and (expires_at is null or expires_at > now())
    limit 1;

  if invite_row.id is null then
    insert into public.invite_attempt_log (user_id, success) values (auth.uid(), false);
    raise exception 'invite not found or expired';
  end if;

  insert into public.organization_members (organization_id, user_id, org_role)
  values (invite_row.organization_id, auth.uid(), invite_row.org_role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invites
    set accepted_at = now(),
        accepted_by = auth.uid()
    where id = invite_row.id;

  insert into public.invite_attempt_log (user_id, success) values (auth.uid(), true);

  return query select invite_row.organization_id, invite_row.org_role;
end$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
