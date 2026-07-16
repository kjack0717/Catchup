#!/usr/bin/env node
/**
 * catchup-sync-schools.mjs — Stage 2-5 학교 동기화 잡
 * ---------------------------------------------------------------------------
 * 목적: 신설·폐교·개명·통폐합을 주기적으로 반영해 전국 고교 완전성을 유지한다.
 *
 * 설계 근거(중요):
 *   NEIS schoolInfo 엔드포인트는 "수정분만" 뽑아오는 신뢰할 만한 delta 필터가 없다.
 *   전체 고교가 2,400여 개로 작으므로, 매 실행 시 전량을 fetch → DB 스냅샷과 diff 하는
 *   방식이 가장 정확하고 단순하다.
 *     - incremental(월 1회): 전량 fetch → 신규/변경 upsert, 사라진 학교는 '폐교 후보'로 플래그(비활성화)만.
 *     - full(매년 3월)     : incremental 전부 + 완전성 재검증 + 폐교 후보를 실제 반영(리포트 산출).
 *
 * 실행:
 *   node catchup-sync-schools.mjs --mode=incremental
 *   node catchup-sync-schools.mjs --mode=full
 *   node catchup-sync-schools.mjs --mode=incremental --dry-run
 *
 * 필요 ENV:
 *   NEIS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 의존성:  npm i @supabase/supabase-js
 *
 * 가정(배포 전 확인):
 *   - schools 테이블 컬럼: school_code(PK, =SD_SCHUL_CODE), school_name, region,
 *     school_type, address, foundation_name, source_load_dtm, is_active, updated_at
 *     → 실제 catchup-schema-rls.sql 컬럼명과 맞춰 NORMALIZE()·upsert onConflict 조정할 것.
 *   - classifyType / prettyRegion 은 Stage 2(ingest-schools.mjs)의 로직을 미러링한 최소 버전.
 *     운영 시 공용 모듈로 추출해 ingest 와 sync 가 같은 함수를 쓰게 통합 권장.
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// 0. 설정
// ─────────────────────────────────────────────────────────────────────────
const NEIS_BASE = "https://open.neis.go.kr/hub/schoolInfo";
const PAGE_SIZE = 1000;          // NEIS 페이지당 최대 행
const SCHOOL_KIND = "고등학교";   // schoolInfo SCHUL_KND_SC_NM
const COMPLETENESS_FLOOR = 2300; // 이보다 적게 잡히면 NEIS 장애로 보고 쓰기 중단(현재 2,404)
const MAX_RETRY = 4;
const RETRY_BASE_MS = 800;

const { NEIS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    })
  );
  const mode = args.mode === "full" ? "full" : "incremental";
  return { mode, dryRun: Boolean(args["dry-run"]) };
}

function assertEnv() {
  const missing = ["NEIS_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`✖ 필수 환경변수 누락: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────
// 1. Stage 2 로직 미러 (분류/지역 정규화) — 공용 모듈로 통합 권장
// ─────────────────────────────────────────────────────────────────────────
function classifyType(row) {
  // 유형 분포 기준: 일반고 / 특성화고 / 특목고 / 자율고
  const kind = row.HS_SC_NM || row.SCHUL_KND_SC_NM || "";
  if (/특수/.test(kind)) return "특수";
  if (/특성화/.test(kind)) return "특성화고";
  if (/특수목적/.test(kind)) return "특목고";
  if (/자율/.test(kind)) return "자율고";
  if (/일반/.test(kind)) return "일반고";
  return kind || "미분류";
}

function prettyRegion(row) {
  // 2026-07-01 광역단체 통합(17→16) 대응: 매직넘버 대신 권역 키워드로 정규화.
  // NEIS가 '전남광주통합특별시(광주)/(전남)' 형태로 반환하는 케이스를 흡수한다.
  const raw = (row.ATPT_OFCDC_SC_NM || row.LCTN_SC_NM || "").trim();
  const m = raw.match(/\(([^)]+)\)\s*$/); // 괄호 안 실제 권역 우선
  const region = m ? m[1] : raw;
  return region
    .replace(/특별자치도|특별자치시|광역시|특별시/g, "")
    .replace(/교육청|통합특별시/g, "")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// 2. NEIS 전량 수집 (페이지 순회 + 재시도)
// ─────────────────────────────────────────────────────────────────────────
async function fetchPage(pIndex) {
  const url =
    `${NEIS_BASE}?KEY=${NEIS_API_KEY}&Type=json&pIndex=${pIndex}&pSize=${PAGE_SIZE}` +
    `&SCHUL_KND_SC_NM=${encodeURIComponent(SCHOOL_KIND)}`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // NEIS 정상 응답: { schoolInfo: [ {head:[...]}, {row:[...]} ] }
      // 데이터 없음: { RESULT: { CODE: "INFO-200", ... } }
      if (json.RESULT?.CODE === "INFO-200") return { rows: [], total: 0, done: true };
      const block = json.schoolInfo;
      if (!block) throw new Error(`예상 밖 응답: ${JSON.stringify(json).slice(0, 200)}`);

      const head = block[0]?.head ?? [];
      const total = head[0]?.list_total_count ?? 0;
      const code = head[1]?.RESULT?.CODE;
      if (code && code !== "INFO-000")
        throw new Error(`NEIS RESULT ${code}`);

      const rows = block[1]?.row ?? [];
      return { rows, total, done: false };
    } catch (err) {
      if (attempt === MAX_RETRY) throw err;
      const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(`  ↻ pIndex=${pIndex} 재시도 ${attempt}/${MAX_RETRY} (${err.message}) → ${wait}ms`);
      await sleep(wait);
    }
  }
  return { rows: [], total: 0, done: true };
}

async function fetchAllHighSchools() {
  const all = [];
  let pIndex = 1;
  let total = Infinity;

  while (all.length < total) {
    const { rows, total: t, done } = await fetchPage(pIndex);
    if (done || rows.length === 0) break;
    total = t || total;
    all.push(...rows);
    process.stdout.write(`\r  수집 ${all.length}/${total}`);
    if (rows.length < PAGE_SIZE) break;
    pIndex++;
    await sleep(120); // 예의상 rate limit
  }
  process.stdout.write("\n");
  return all;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 정규화 & diff
// ─────────────────────────────────────────────────────────────────────────
function normalize(row) {
  return {
    school_code: row.SD_SCHUL_CODE,          // 커뮤니티 ID
    school_name: (row.SCHUL_NM || "").trim(),
    region: prettyRegion(row),
    school_type: classifyType(row),
    address: (row.ORG_RDNMA || "").trim(),
    foundation_name: (row.FOND_SC_NM || "").trim(), // 공립/사립 등
    source_load_dtm: row.LOAD_DTM || null,
    is_active: true,
  };
}

function dedupeByCode(records) {
  const map = new Map();
  for (const r of records) {
    if (!r.school_code) continue;
    map.set(r.school_code, r); // 마지막 값 우선
  }
  return [...map.values()];
}

// ─────────────────────────────────────────────────────────────────────────
// 4. 메인
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const { mode, dryRun } = parseArgs();
  assertEnv();

  console.log(`\n▶ Catchup 학교 동기화 [mode=${mode}${dryRun ? " · DRY-RUN" : ""}]`);
  const t0 = Date.now();

  // (1) NEIS 전량 수집
  const rawRows = await fetchAllHighSchools();
  const fresh = dedupeByCode(rawRows.map(normalize));
  console.log(`  정규화·중복제거 후: ${fresh.length}개`);

  // (2) 완전성 게이트 — 급락 시 DB 손상 방지 위해 쓰기 중단
  if (fresh.length < COMPLETENESS_FLOOR) {
    console.error(
      `✖ 완전성 게이트 실패: ${fresh.length} < ${COMPLETENESS_FLOOR}. NEIS 응답 이상 가능성 → 쓰기 중단.`
    );
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // (3) 현재 DB 스냅샷 로드
  const { data: existing, error: readErr } = await supabase
    .from("schools")
    .select("school_code, school_name, region, school_type, is_active");
  if (readErr) {
    console.error("✖ DB 조회 실패:", readErr.message);
    process.exit(3);
  }
  const existingMap = new Map((existing ?? []).map((r) => [r.school_code, r]));
  const freshCodes = new Set(fresh.map((r) => r.school_code));

  // (4) diff 계산
  const added = fresh.filter((r) => !existingMap.has(r.school_code));
  const changed = fresh.filter((r) => {
    const cur = existingMap.get(r.school_code);
    return (
      cur &&
      (cur.school_name !== r.school_name ||
        cur.region !== r.region ||
        cur.school_type !== r.school_type ||
        cur.is_active === false) // 부활(재활성) 포함
    );
  });
  const closedCandidates = (existing ?? []).filter(
    (r) => r.is_active !== false && !freshCodes.has(r.school_code)
  );

  console.log(
    `  diff → 신규 ${added.length} · 변경 ${changed.length} · 폐교후보 ${closedCandidates.length}`
  );

  if (dryRun) {
    printReport({ mode, added, changed, closedCandidates, total: fresh.length, t0, dryRun });
    return;
  }

  // (5) upsert (신규 + 변경). onConflict 는 실제 PK/유니크에 맞출 것.
  const toUpsert = [...added, ...changed].map((r) => ({
    ...r,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < toUpsert.length; i += 500) {
    const batch = toUpsert.slice(i, i + 500);
    const { error } = await supabase
      .from("schools")
      .upsert(batch, { onConflict: "school_code" });
    if (error) {
      console.error("✖ upsert 실패:", error.message);
      process.exit(4);
    }
  }

  // (6) 폐교 후보 처리
  //     incremental: 플래그(비활성화)만 — 오탐 방지. 실제 삭제 안 함.
  //     full(3월)   : 동일하게 비활성화하되, 리포트로 수동 확인 유도(통폐합 개명 구분).
  if (closedCandidates.length) {
    const codes = closedCandidates.map((r) => r.school_code);
    const { error } = await supabase
      .from("schools")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("school_code", codes);
    if (error) console.error("⚠ 폐교후보 비활성화 실패:", error.message);
  }

  printReport({ mode, added, changed, closedCandidates, total: fresh.length, t0, dryRun });
}

function printReport({ mode, added, changed, closedCandidates, total, t0, dryRun }) {
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n──────── 동기화 리포트 ────────");
  console.log(`모드      : ${mode}${dryRun ? " (dry-run)" : ""}`);
  console.log(`전체 학교 : ${total}`);
  console.log(`신규      : ${added.length}`);
  console.log(`변경      : ${changed.length}`);
  console.log(`폐교후보  : ${closedCandidates.length}`);
  if (closedCandidates.length) {
    console.log("  └ 수동확인 필요(통폐합·개명 vs 실제폐교):");
    for (const c of closedCandidates.slice(0, 20))
      console.log(`     · ${c.school_code} ${c.school_name} (${c.region})`);
    if (closedCandidates.length > 20) console.log(`     … 외 ${closedCandidates.length - 20}개`);
  }
  console.log(`소요      : ${secs}s`);
  console.log("───────────────────────────────\n");
}

main().catch((e) => {
  console.error("✖ 치명적 오류:", e);
  process.exit(10);
});
