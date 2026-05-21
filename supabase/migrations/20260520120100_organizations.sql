-- Backend Phase 1A — BF1A.2
-- Organizations table — the multi tenancy root. Every downstream
-- design entity in 1B will carry an organization_id that points
-- here. RLS in BF1A.3 makes the org boundary the real isolation
-- mechanism.

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users on delete set null
);

comment on table public.organizations is
  'Multi tenancy root. Every project / customer / device in Phase 1B carries an organization_id pointing here. The creator becomes the first owner via organization_members.';
