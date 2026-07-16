-- ============================================================
-- Catchup — Stage 3: 기본 스키마 + 학교 격리 RLS
-- 적용 방법: Supabase Dashboard → SQL Editor에 전체 붙여넣기 → Run
-- 원칙: 학교코드(school_code) = 커뮤니티 경계. RLS가 뚫리면 서비스 의미 상실.
-- ============================================================

-- ── 1. schools — Stage 2 수집 데이터가 적재되는 곳 ──────────
create table if not exists public.schools (
  school_code   text primary key,            -- SD_SCHUL_CODE = 커뮤니티 ID
  office_code   text not null,               -- ATPT_OFCDC_SC_CODE (급식·학사일정 API 호출에 필수)
  name          text not null,
  name_en       text,
  type          text not null,               -- 일반고/특성화고/특목고/자율고/방송통신고/대안·각종학교
  sido          text not null,
  address       text,
  homepage      text,
  coedu         text,
  found_type    text,                        -- 국립/공립/사립
  email_domain  text,                        -- 이메일 자동 인증 도메인 대조용
  is_open       boolean not null default false,  -- 인증 20명 게이트 통과 시 true (콜드스타트 방지)
  synced_at     timestamptz not null default now()
);

create index if not exists idx_schools_name on public.schools using gin (name gin_trgm_ops);
-- ↑ 학교명 부분 검색용. 사전 필요: create extension if not exists pg_trgm;

-- ── 2. profiles — auth.users 1:1, 소속 학교 고정 ────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  school_code   text not null references public.schools(school_code),
  nickname      text not null,
  grade         smallint check (grade between 1 and 3),
  verified_at   timestamptz,                 -- 재학 인증 완료 시각 (null = 미인증)
  verify_method text check (verify_method in ('email','student_id_card')),
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── 3. posts / comments — 학교 경계 안의 UGC ────────────────
create table if not exists public.posts (
  id            bigint generated always as identity primary key,
  school_code   text not null references public.schools(school_code),
  author_id     uuid not null references public.profiles(id),
  board         text not null check (board in ('free','info','susi')),
  title         text not null check (char_length(title) between 1 and 100),
  body          text not null check (char_length(body) between 1 and 5000),
  is_anonymous  boolean not null default true,
  is_blinded    boolean not null default false,   -- 신고 3건 자동 블라인드 (moderation-schema 트리거와 연동)
  like_count    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.comments (
  id            bigint generated always as identity primary key,
  post_id       bigint not null references public.posts(id) on delete cascade,
  school_code   text not null references public.schools(school_code),  -- 비정규화: RLS 단순·고속화
  author_id     uuid not null references public.profiles(id),
  body          text not null check (char_length(body) between 1 and 1000),
  is_anonymous  boolean not null default true,
  is_blinded    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_posts_school_board on public.posts (school_code, board, created_at desc);
create index if not exists idx_comments_post on public.comments (post_id, created_at);

-- ── 4. 헬퍼 함수 — 현재 사용자의 학교코드 ───────────────────
-- security definer: profiles에 대한 RLS와 무관하게 자기 학교코드만 반환
create or replace function public.my_school_code()
returns text
language sql stable security definer set search_path = public
as $$
  select school_code from public.profiles
  where id = auth.uid() and verified_at is not null and not is_suspended
$$;

-- ── 5. RLS — 학교 격리의 실체 ───────────────────────────────
alter table public.schools  enable row level security;
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- schools: 검색은 전원 공개 (온보딩에서 학교 찾기)
drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools
  for select using (true);

-- profiles: 본인 것만 읽기/쓰기. school_code 변경은 차단(전학 처리는 어드민 경유)
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and school_code = (select school_code from public.profiles where id = auth.uid()));

-- posts: 핵심 격리 정책 — 내 학교 글만 보이고, 내 학교에만 쓸 수 있다
drop policy if exists posts_same_school_select on public.posts;
create policy posts_same_school_select on public.posts
  for select using (school_code = public.my_school_code());

drop policy if exists posts_same_school_insert on public.posts;
create policy posts_same_school_insert on public.posts
  for insert with check (
    school_code = public.my_school_code()
    and author_id = auth.uid()
  );

drop policy if exists posts_author_update on public.posts;
create policy posts_author_update on public.posts
  for update using (author_id = auth.uid() and school_code = public.my_school_code());

drop policy if exists posts_author_delete on public.posts;
create policy posts_author_delete on public.posts
  for delete using (author_id = auth.uid());

-- comments: posts와 동일 원칙
drop policy if exists comments_same_school_select on public.comments;
create policy comments_same_school_select on public.comments
  for select using (school_code = public.my_school_code());

drop policy if exists comments_same_school_insert on public.comments;
create policy comments_same_school_insert on public.comments
  for insert with check (
    school_code = public.my_school_code()
    and author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and p.school_code = public.my_school_code())
  );

-- ============================================================
-- Gate 3 검증 테스트 — "서로 다른 학교 계정이 상대 글을 절대 못 본다"
-- SQL Editor에서 아래 블록을 순서대로 실행. 마지막 두 쿼리의 기대값 주석 확인.
-- ============================================================
/*
-- (0) 테스트 데이터
insert into public.schools (school_code, office_code, name, type, sido) values
  ('9000001','B10','격리테스트A고','일반고','서울특별시'),
  ('9000002','J10','격리테스트B고','일반고','경기도')
on conflict do nothing;

-- 테스트 유저 2명은 Supabase Auth에서 생성 후 UUID를 아래에 대입
-- userA = A고 재학생, userB = B고 재학생
insert into public.profiles (id, school_code, nickname, verified_at, verify_method) values
  ('<USER_A_UUID>','9000001','테스터A', now(), 'email'),
  ('<USER_B_UUID>','9000002','테스터B', now(), 'email');

-- (1) userA로 로그인한 세션에서:
insert into public.posts (school_code, author_id, board, title, body)
values ('9000001','<USER_A_UUID>','free','A고 내부 글','A고 학생만 봐야 함');

-- (2) userB로 로그인한 세션에서:
select count(*) from public.posts where school_code = '9000001';
-- 기대값: 0  ← 1 이상이면 격리 실패. 출시 불가.

insert into public.posts (school_code, author_id, board, title, body)
values ('9000001','<USER_B_UUID>','free','침투 시도','B고 학생이 A고에 쓰기 시도');
-- 기대값: new row violates row-level security policy 에러

-- (3) 미인증 계정(verified_at null) 세션에서:
select count(*) from public.posts;
-- 기대값: 0  ← my_school_code()가 null을 반환하므로 아무 글도 안 보임
*/
