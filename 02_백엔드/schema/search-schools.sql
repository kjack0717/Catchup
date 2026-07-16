-- ============================================================
-- Catchup — Stage 3-3: 학교 검색 API (RPC)
-- 적용: Supabase SQL Editor에 붙여넣고 Run
-- 목적: 앱 온보딩의 "학교 찾기"가 2,404개 데이터 위에서 즉시 검색되게 한다.
-- 원칙: 앱은 raw SQL을 날리지 않는다. 랭킹·지역보정을 담은 함수 하나만 호출한다.
-- 선행: schools 테이블에 pg_trgm gin 인덱스(idx_schools_name)가 있어야 빠르다.
-- ============================================================

create or replace function public.search_schools(
  q text,                       -- 검색어 (학교명 또는 지역명)
  max_results int default 20
)
returns table (
  school_code text,
  name        text,
  name_en     text,
  type        text,
  sido        text,
  address     text,
  is_open     boolean
)
language sql
stable
security invoker              -- 호출자 권한으로 실행 → schools_read RLS(using true) 적용
set search_path = public
as $$
  with cleaned as (
    select nullif(btrim(q), '') as q
  )
  select s.school_code, s.name, s.name_en, s.type, s.sido, s.address, s.is_open
  from public.schools s, cleaned c
  where c.q is not null
    and (
      s.name    ilike '%' || c.q || '%'      -- 학교명 부분일치
      or s.sido    ilike '%' || c.q || '%'   -- 지역명 부분일치 ('광주'→'전남광주통합특별시(광주)'도 잡힘)
      or s.name_en ilike '%' || c.q || '%'   -- 영문명
    )
  order by
    (s.name ilike c.q || '%') desc,          -- ① 이름이 검색어로 시작 (가장 정확)
    (s.name ilike '%' || c.q || '%') desc,   -- ② 이름에 포함
    similarity(s.name, c.q) desc,            -- ③ 오타 허용 트라이그램 유사도
    s.is_open desc,                          -- ④ 이미 개설된 학교 우선(콜드스타트 방지 UX)
    s.name
  limit greatest(1, least(max_results, 50)); -- 1~50 사이로 강제 (과다 조회 방지)
$$;

-- 앱(anon)과 로그인 사용자(authenticated) 모두 검색 가능하게 실행 권한 부여
grant execute on function public.search_schools(text, int) to anon, authenticated;

-- ── 동작 확인 ──────────────────────────────────────────────
-- select * from search_schools('과학', 10);      -- 이름에 '과학' 들어간 학교
-- select * from search_schools('광주', 10);      -- 통합특별시(광주) 소속 학교가 잡히는지
-- select * from search_schools('서울과학', 5);   -- 접두어 우선 랭킹 확인
