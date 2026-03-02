create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.signals (
  id bigint generated always as identity primary key,
  signal_date date not null,
  source_name text not null,
  source_url text not null,
  title text not null,
  link text not null,
  published_at timestamptz,
  airline text,
  role text,
  summary text not null,
  confidence text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  draft_date date not null unique,
  post text not null,
  source_json jsonb not null,
  status text not null default 'pending',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.drafts(id) on delete set null,
  post text not null,
  publish_result jsonb,
  posted_at timestamptz not null default now()
);

insert into public.sources(name, url, enabled)
values
  ('koreanair-recruit', 'https://koreanair.recruiter.co.kr/career/apply', true),
  ('asiana-recruit', 'https://flyasiana.recruiter.co.kr/career/recruitment', true),
  ('naver-jjooo112', 'https://blog.naver.com/jjooo112', true),
  ('naver-olive2269', 'https://blog.naver.com/olive2269', true),
  ('naver-bongbongb0ng', 'https://blog.naver.com/bongbongb0ng', true),
  ('naver-on-fly', 'https://blog.naver.com/on_fly', true),
  ('instagram-crewfactory-jh', 'https://www.instagram.com/crewfactory.hc_jh/', true),
  ('threads-ije-writer', 'https://www.threads.com/@ije_writer', true),
  ('instagram-crewfactory-sunny', 'https://www.instagram.com/crewfactory.hc_sunny/', true),
  ('instagram-koreanair', 'https://www.instagram.com/koreanair/', true),
  ('instagram-wingsky', 'https://www.instagram.com/wingsky_official/', true),
  ('instagram-on-fly', 'https://www.instagram.com/on___fly/', true),
  ('facebook-wingskygj', 'https://www.facebook.com/wingskygj', true),
  ('naver-anacast', 'https://blog.naver.com/anacast', true)
on conflict (url) do nothing;
