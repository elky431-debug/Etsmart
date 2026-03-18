-- Colonnes Keyword Research (source Alura + taille de marché)
alter table public.keyword_research_history
  add column if not exists data_source text default 'etsy';

alter table public.keyword_research_history
  add column if not exists market_size_estimate bigint;

alter table public.keyword_research_history
  add column if not exists alura_overview jsonb;

alter table public.keyword_research_history
  drop constraint if exists keyword_research_history_data_source_check;

alter table public.keyword_research_history
  add constraint keyword_research_history_data_source_check
  check (data_source is null or data_source in ('etsy', 'alura'));
