create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  cron_name text not null,
  run_at timestamptz not null default now(),
  ok boolean not null,
  status_code int,
  summary text not null,
  details jsonb
);
