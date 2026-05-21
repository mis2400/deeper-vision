-- Backend Phase 1A — BF1A.2
-- Profiles table that extends auth.users with the operator facing
-- fields the SPA needs (display name, avatar, user type).
--
-- - id mirrors auth.users.id and cascades on delete so removing a
--   Supabase auth user always cleans up the profile.
-- - user_type carves 'internal' (Access Tech operators) vs
--   'customer' (end customer portals). The brief calls out a single
--   account system; this tag drives later UX gating, not access.
-- - A trigger on auth.users insert creates the matching row so the
--   SPA never has to do it by hand on sign up.

-- ─── enum: user_type ────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type user_type as enum ('internal', 'customer');
  end if;
end$$;

-- ─── table: profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  email        text,
  avatar_url   text,
  user_type    user_type not null default 'customer',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Mirror of auth.users with operator facing fields. One row per signed up user. Created automatically by handle_new_user() trigger.';

-- ─── trigger function: keep updated_at fresh ────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ─── trigger function: auto create profile on sign up ───────────────
-- Runs as security definer so it can write to public.profiles even
-- though the inserting auth role can't directly. The function body
-- is intentionally minimal — no email validation, no fancy logic —
-- because that belongs in the app, not in a trigger.
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
