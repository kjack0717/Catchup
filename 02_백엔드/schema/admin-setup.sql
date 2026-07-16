-- ============================================================
-- Catchup — Stage 3-8: 검수 관리자 등록
-- 적용: Supabase SQL Editor에 붙여넣고 Run
-- ============================================================

create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- 정책 없음 = service_role(서버)만 접근. 클라이언트는 관리자 목록을 볼 수 없음.

-- 현재 사용자가 관리자인지 (Edge Function/RLS에서 재사용 가능)
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = uid)
$$;

-- ── 본인을 첫 관리자로 등록 ─────────────────────────────────
-- 1) Authentication → Users 에서 본인 계정의 UUID 복사
-- 2) 아래 주석을 풀고 UUID를 넣어 실행
-- insert into public.admins (user_id) values ('<YOUR_USER_UUID>') on conflict do nothing;

-- 확인:
-- select * from public.admins;
