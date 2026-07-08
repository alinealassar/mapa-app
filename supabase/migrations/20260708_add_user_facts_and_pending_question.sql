create table if not exists public.user_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact text not null,
  category text,
  source_entry_id uuid,
  created_at timestamptz not null default now()
);

alter table public.user_facts enable row level security;

create policy "user_facts_select_own" on public.user_facts
  for select using ((select auth.uid()) = user_id);

create index if not exists user_facts_user_idx
  on public.user_facts (user_id, created_at desc);

alter table public.profiles
  add column if not exists pending_question text,
  add column if not exists pending_question_at timestamptz;
