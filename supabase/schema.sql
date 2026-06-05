create table if not exists listings (
  fingerprint text primary key,
  source text not null,
  external_id text,
  normalized_url text not null,
  original_url text not null,
  title text not null,
  price_text text,
  price_value numeric,
  currency text,
  location text,
  summary text,
  raw_text text,
  score numeric not null,
  compatibility_label text not null,
  reasons_json jsonb not null default '[]'::jsonb,
  attributes_json jsonb not null default '{}'::jsonb,
  search_term text,
  first_seen_utc timestamptz not null,
  last_seen_utc timestamptz not null
);

create table if not exists listing_history (
  id bigint generated always as identity primary key,
  fingerprint text not null references listings(fingerprint) on delete cascade,
  seen_at_utc timestamptz not null,
  score numeric not null,
  price_text text,
  price_value numeric,
  compatibility_label text not null
);

create table if not exists alerts (
  fingerprint text primary key references listings(fingerprint) on delete cascade,
  transport text not null,
  alerted_at_utc timestamptz not null,
  payload_json jsonb not null default '{}'::jsonb,
  acknowledged boolean not null default false
);

create table if not exists watch_runs (
  id bigint generated always as identity primary key,
  started_at_utc timestamptz not null,
  compatible_count integer not null,
  provider_count integer not null,
  error_count integer not null,
  alerts_sent integer not null,
  provider_stats_json jsonb not null default '[]'::jsonb,
  provider_errors_json jsonb not null default '[]'::jsonb
);

alter table listings enable row level security;
alter table listing_history enable row level security;
alter table alerts enable row level security;
alter table watch_runs enable row level security;

drop policy if exists "public read listings" on listings;
drop policy if exists "public read watch_runs" on watch_runs;

create policy "public read listings" on listings for select using (true);
create policy "public read watch_runs" on watch_runs for select using (true);
