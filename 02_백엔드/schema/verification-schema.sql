-- ============================================================
-- Catchup — Stage 3-6: 학생증 재학인증 (주 인증 방법)
-- 적용: Supabase SQL Editor에 전체 붙여넣기 → Run
--
-- 설계 원칙
--  ① 역할 분리: 이메일/소셜 = 로그인, 학생증 = 재학 증명
--  ② 이미지 최단 보관: 결정(승인/거절) 즉시 파기 대상 → 파기 여부를 스키마로 추적
--  ③ 승인 경로 단일화: 오직 decide_verification() 함수로만 승인/거절
--  ④ identity_hash 연동: 같은 학생증 중복 사용·영구정지자 재가입 차단
-- 선행: catchup-schema-rls.sql (profiles.verified_at / verify_method 존재)
-- ============================================================

-- ── 0. profiles.verify_method 값 보정 ───────────────────────
-- 기존 체크제약이 ('email','student_id_card')였음 → 학생증 주 인증 체제 유지, 그대로 사용 가능.

-- ── 1. 영구정지 신원 해시 (identity-hash.md 설계의 실체) ────
create table if not exists public.banned_identities (
  identity_hash text primary key,             -- HMAC-SHA256(정규화된 신원 seed, pepper)
  reason        text not null,
  banned_at     timestamptz not null default now()
);

-- ── 2. 인증 요청 테이블 ─────────────────────────────────────
create table if not exists public.verification_requests (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  school_code     text not null references public.schools(school_code),

  -- 학생증 이미지: Supabase Storage 비공개 버킷 'student-ids'의 경로만 저장
  image_path      text not null,
  image_purged_at timestamptz,                -- 파기 완료 시각. null이면 아직 파기 안 됨 = 점검 대상

  -- OCR 결과 (원문 이미지 파기 후에도 검수 근거로 남는 최소 텍스트)
  ocr_school_name text,
  ocr_student_name text,
  ocr_issue_year  smallint,                   -- 발급년도 (졸업생 위장 방지 단서)
  ocr_confidence  numeric(4,3),               -- 0.000~1.000

  -- 신원 해시: 같은 학생증(동일 인물+학교)의 중복 제출·재가입 차단
  identity_hash   text,

  status          text not null default 'pending'
                  check (status in ('pending','auto_approved','approved','rejected')),
  reject_reason   text,
  decided_by      text check (decided_by in ('auto','admin')),
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_verif_status on public.verification_requests (status, created_at);
create index if not exists idx_verif_user   on public.verification_requests (user_id, created_at desc);
create index if not exists idx_verif_hash   on public.verification_requests (identity_hash) where identity_hash is not null;

-- ── 3. RLS ──────────────────────────────────────────────────
alter table public.verification_requests enable row level security;
alter table public.banned_identities     enable row level security;

-- 본인 요청만 조회 가능 (image_path 노출은 본인 것이므로 무해)
drop policy if exists verif_self_select on public.verification_requests;
create policy verif_self_select on public.verification_requests
  for select using (user_id = auth.uid());

-- 요청 생성은 본인 명의로만, 상태는 pending으로만
drop policy if exists verif_self_insert on public.verification_requests;
create policy verif_self_insert on public.verification_requests
  for insert with check (user_id = auth.uid() and status = 'pending');

-- update/delete 정책 없음 = 클라이언트는 상태를 절대 못 바꿈 (함수로만 결정)
-- banned_identities: 정책 없음 = service_role(서버)만 접근. 클라이언트 완전 차단.

-- ── 4. 제출 함수 — 중복·차단 검사를 통과해야 접수 ───────────
create or replace function public.submit_verification(
  p_school_code text,
  p_image_path  text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint;
begin
  -- 이미 인증된 사용자면 거부
  if exists (select 1 from profiles where id = auth.uid() and verified_at is not null) then
    raise exception '이미 재학 인증이 완료된 계정입니다.';
  end if;
  -- 진행 중 요청이 있으면 거부 (도배 방지)
  if exists (select 1 from verification_requests
             where user_id = auth.uid() and status = 'pending') then
    raise exception '검토 중인 인증 요청이 이미 있습니다.';
  end if;

  insert into verification_requests (user_id, school_code, image_path)
  values (auth.uid(), p_school_code, p_image_path)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.submit_verification(text, text) to authenticated;

-- ── 5. 결정 함수 — 승인/거절의 유일한 경로 ──────────────────
-- 서버(Edge Function, service_role)에서만 호출. OCR 결과와 해시를 함께 기록.
create or replace function public.decide_verification(
  p_request_id     bigint,
  p_approve        boolean,
  p_decided_by     text,              -- 'auto' | 'admin'
  p_identity_hash  text default null,
  p_ocr_school     text default null,
  p_ocr_name       text default null,
  p_ocr_issue_year smallint default null,
  p_ocr_confidence numeric default null,
  p_reject_reason  text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_req verification_requests%rowtype;
begin
  select * into v_req from verification_requests where id = p_request_id for update;
  if not found then raise exception '요청 없음: %', p_request_id; end if;
  if v_req.status <> 'pending' then raise exception '이미 결정된 요청입니다.'; end if;

  -- 승인 전 차단 검사 (identity_hash가 있을 때)
  if p_approve and p_identity_hash is not null then
    -- ① 영구정지자 재가입 차단
    if exists (select 1 from banned_identities where identity_hash = p_identity_hash) then
      p_approve := false;
      p_reject_reason := coalesce(p_reject_reason, '이용이 제한된 신원입니다. 이의는 문의 채널로 접수해 주세요.');
    -- ② 같은 학생증으로 이미 승인된 다른 계정 존재 → 중복 차단
    elsif exists (select 1 from verification_requests
                  where identity_hash = p_identity_hash
                    and status in ('approved','auto_approved')
                    and user_id <> v_req.user_id) then
      p_approve := false;
      p_reject_reason := coalesce(p_reject_reason, '이미 다른 계정에서 사용된 학생증입니다.');
    end if;
  end if;

  update verification_requests set
    status          = case when p_approve
                           then (case when p_decided_by = 'auto' then 'auto_approved' else 'approved' end)
                           else 'rejected' end,
    identity_hash   = coalesce(p_identity_hash, identity_hash),
    ocr_school_name = coalesce(p_ocr_school, ocr_school_name),
    ocr_student_name= coalesce(p_ocr_name, ocr_student_name),
    ocr_issue_year  = coalesce(p_ocr_issue_year, ocr_issue_year),
    ocr_confidence  = coalesce(p_ocr_confidence, ocr_confidence),
    reject_reason   = case when p_approve then null else p_reject_reason end,
    decided_by      = p_decided_by,
    decided_at      = now()
  where id = p_request_id;

  -- 승인 시 프로필에 인증 도장
  if p_approve then
    update profiles set
      verified_at   = now(),
      verify_method = 'student_id_card',
      school_code   = v_req.school_code
    where id = v_req.user_id;
  end if;
end $$;

-- 클라이언트 호출 금지: authenticated에 grant하지 않음 (service_role만)
revoke execute on function public.decide_verification from public, anon, authenticated;

-- ── 6. 이미지 파기 기록 함수 ────────────────────────────────
-- Storage에서 실제 삭제한 뒤(서버 배치) 이 함수로 파기 시각을 남긴다.
create or replace function public.mark_image_purged(p_request_id bigint)
returns void language sql security definer set search_path = public as $$
  update verification_requests set image_purged_at = now() where id = p_request_id;
$$;
revoke execute on function public.mark_image_purged from public, anon, authenticated;

-- ── 7. 운영용 뷰 ────────────────────────────────────────────
-- 검수 큐: 사람이 봐야 할 pending 목록 (오래된 순)
create or replace view public.v_review_queue as
  select r.id, r.created_at, s.name as school_name, s.sido,
         r.ocr_school_name, r.ocr_confidence, r.image_path
  from verification_requests r
  join schools s on s.school_code = r.school_code
  where r.status = 'pending'
  order by r.created_at;

-- 파기 점검: 결정 완료됐는데 이미지가 아직 안 지워진 건 (있으면 0이어야 정상)
create or replace view public.v_purge_backlog as
  select id, status, decided_at, image_path
  from verification_requests
  where status <> 'pending' and image_purged_at is null;

-- ============================================================
-- Storage 버킷 (SQL 아님 — 대시보드에서 1회 설정)
--  Storage → New bucket: 이름 'student-ids', Public 체크 해제(비공개)
--  정책: authenticated는 자기 폴더({uid}/*)에 업로드만, 읽기는 service_role만.
-- ============================================================

-- ── 검증 테스트 (적용 후 실행) ──────────────────────────────
-- select count(*) from verification_requests;              -- 0
-- select * from v_review_queue;                            -- 빈 결과
-- select * from v_purge_backlog;                           -- 빈 결과 (항상 0이어야 함)
