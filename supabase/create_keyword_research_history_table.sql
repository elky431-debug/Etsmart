-- Keyword Research history storage
create table if not exists public.keyword_research_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  source_url text not null,
  demand_score integer not null,
  competition_score integer not null,
  opportunity_score integer not null,
  saturation_level text not null check (saturation_level in ('Low', 'Medium', 'High')),
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  verdict text not null check (verdict in ('Launch', 'Test', 'Avoid')),
  average_price numeric(10,2) not null default 0,
  average_reviews numeric(10,2) not null default 0,
  top_shops_concentration numeric(6,2) not null default 0,
  listings_count integer not null default 0,
  raw_listings jsonb not null default '[]'::jsonb,
  ai_analysis jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_keyword_research_history_user_created_at
  on public.keyword_research_history(user_id, created_at desc);

alter table public.keyword_research_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_research_history'
      and policyname = 'keyword_research_history_select_own'
  ) then
    create policy keyword_research_history_select_own
      on public.keyword_research_history
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_research_history'
      and policyname = 'keyword_research_history_insert_own'
  ) then
    create policy keyword_research_history_insert_own
      on public.keyword_research_history
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
