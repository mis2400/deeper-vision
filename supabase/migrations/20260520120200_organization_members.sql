-- Backend Phase 1A — BF1A.2
-- Organization members — the user ↔ organization junction with a
-- per organization role. A user can belong to multiple orgs (e.g.
-- a customer who also runs a consultancy); each membership carries
-- its own role.
--
-- org_role values:
--   owner — full control + can transfer ownership / delete the org.
--   admin — can manage memberships + project settings.
--   member — read + work within the org.
--
-- Granular per project roles (Designer, Discipline Editor, Field
-- Surveyor, Reviewer, Customer Viewer, Customer Collaborator, Read
-- Only) ship on a separate project_members table in Phase 1B. See
-- docs/BACKEND_SCHEMA_PLAN.md for the full plan.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type org_role as enum ('owner', 'admin', 'member');
  end if;
end$$;

create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  org_role        org_role not null default 'member',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Junction between users and organizations, carrying the operator role at the org level. Per project roles live on project_members in Phase 1B.';

-- Hot path indexes for the RLS predicates added in BF1A.3.
create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);
create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);
