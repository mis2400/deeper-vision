-- Backend Phase 1A — enable pgcrypto + fix the two SECURITY DEFINER
-- functions that call gen_random_bytes().
--
-- Cause: my prior migrations called extensions.gen_random_bytes()
-- without the schema qualifier, relying on the call resolving via
-- search_path. The functions set search_path = public for defense
-- in depth, and Supabase installs pgcrypto into the `extensions`
-- schema, so the call doesn't resolve.
--
-- Fix: enable pgcrypto in `extensions` (Supabase convention) and
-- re-create the two callers with fully qualified references. The
-- search_path stays tight at `public` so accidental injection of
-- a same named function elsewhere cannot shadow ours.
--
-- Touches: extension registration + two function bodies. No data
-- modified. No auth internals modified. No RLS policy or grant
-- changed.

create extension if not exists pgcrypto with schema extensions;

-- ─── create_organization_with_owner (fully qualified call) ──────────
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
    generated_slug := base_slug || '-' || encode(extensions.gen_random_bytes(3), 'hex');
    begin
      insert into public.organizations (name, slug, created_by)
      values (trim(org_name), generated_slug, auth.uid())
      returning organizations.id into new_org_id;
      exit;
    exception
      when unique_violation then null;
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

-- ─── create_invite (fully qualified call) ───────────────────────────
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
    generated_code := upper(replace(encode(extensions.gen_random_bytes(8), 'base32'), '=', ''));
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
