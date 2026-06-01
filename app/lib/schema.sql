-- 일룸 X배너 어플 — 로그인/저장 테이블 (Supabase iloom-lsa 공유 인스턴스, public 스키마 xbanner_ 접두)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run

create extension if not exists pgcrypto;

create table if not exists public.xbanner_users (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  pass_hash  text not null,
  created_at timestamptz default now()
);

create table if not exists public.xbanner_banners (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.xbanner_users(id) on delete cascade,
  title      text,
  data       jsonb,
  thumb      text,                      -- 갤러리 썸네일(작은 dataURL)
  share_id   text unique,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists xbanner_banners_user_idx  on public.xbanner_banners(user_id);
create index if not exists xbanner_banners_share_idx on public.xbanner_banners(share_id);

-- RLS 켜두기 — 익명(anon) 접근 차단. 서버는 service_role 키로 접근하므로 RLS 우회(정상 동작).
alter table public.xbanner_users   enable row level security;
alter table public.xbanner_banners enable row level security;
