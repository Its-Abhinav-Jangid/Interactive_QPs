-- PaperDesk — Universal Interactive Exam Portal
-- Initial schema: profiles, papers, attempts, RLS, share-link RPC.
-- Apply with: supabase db push, or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student','teacher')),
  board text,
  class_level text,
  created_at timestamptz not null default now()
);

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subtitle text,
  subject text not null,
  board text,
  duration_minutes integer not null check (duration_minutes > 0),
  max_marks numeric(6,2) not null check (max_marks > 0),
  content jsonb not null,
  visibility text not null default 'private'
    check (visibility in ('private','unlisted','public')),
  share_slug text not null unique default encode(gen_random_bytes(9), 'hex'),
  sender_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index papers_owner_id_idx on public.papers (owner_id);
create index papers_public_idx on public.papers (created_at desc)
  where visibility = 'public';
create index papers_subject_idx on public.papers (subject);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  guest_token text,
  responses jsonb not null default '{}'::jsonb,
  active_choices jsonb not null default '{}'::jsonb,
  remaining_seconds integer not null default 0 check (remaining_seconds >= 0),
  status text not null default 'in_progress'
    check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint attempts_owner_present check (user_id is not null or guest_token is not null),
  -- Required by the client upsert: onConflict: "paper_id,user_id".
  constraint attempts_paper_user_key unique (paper_id, user_id)
);

create index attempts_user_id_idx on public.attempts (user_id);

create trigger papers_set_updated_at
  before update on public.papers
  for each row execute function public.set_updated_at();

create trigger attempts_set_updated_at
  before update on public.attempts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New-user profile bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'learner'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.papers enable row level security;
alter table public.attempts enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Owners see all their papers. Everyone (including anon) can see public papers.
-- Unlisted papers are never exposed through a direct table SELECT; they are
-- served one-at-a-time through get_shared_paper() below.
create policy "papers_select_own_or_public" on public.papers
  for select to anon, authenticated
  using (owner_id = (select auth.uid()) or visibility = 'public');

create policy "papers_insert_own" on public.papers
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "papers_update_own" on public.papers
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "papers_delete_own" on public.papers
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "attempts_select_own" on public.attempts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "attempts_insert_own" on public.attempts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "attempts_update_own" on public.attempts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "attempts_delete_own" on public.attempts
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Share-link lookup
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER is intentional: unlisted papers must be readable through an
-- exact share slug without allowing anon clients to enumerate the table.
-- Setting a paper back to 'private' instantly removes it from this function.
create or replace function public.get_shared_paper(p_slug text)
returns table (
  id uuid,
  title text,
  subtitle text,
  subject text,
  board text,
  duration_minutes integer,
  max_marks numeric,
  content jsonb,
  sender_note text,
  share_slug text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.title, p.subtitle, p.subject, p.board, p.duration_minutes,
         p.max_marks, p.content, p.sender_note, p.share_slug, p.updated_at
  from public.papers p
  where p.share_slug = p_slug
    and p.visibility in ('public', 'unlisted')
  limit 1;
$$;

revoke all on function public.get_shared_paper(text) from public;
grant execute on function public.get_shared_paper(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.papers to anon;
grant select, insert, update, delete on public.papers to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Trigger functions are not callable through the API.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
