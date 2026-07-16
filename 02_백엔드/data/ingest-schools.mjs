#!/usr/bin/env node
/**
 * Catchup — Stage 2: 전국 고등학교 완전 수집 파이프라인
 * ─────────────────────────────────────────────────────
 * NEIS 개방포털 schoolInfo API를 전 페이지 순회하여
 * 대한민국 모든 고등학교를 수집 → 중복 제거 → 유형 분류 →
 * 완전성 검증 → schools.json 산출 (+ 옵션: Supabase upsert)
 *
 * 실행 방법:
 *   1) NEIS 인증키 발급 (open.neis.go.kr → 인증키 신청, 즉시 발급)
 *   2) 환경변수 설정 후 실행:
 *      NEIS_KEY=발급받은키 node ingest-schools.mjs
 *   3) Supabase 적재까지 하려면:
 *      NEIS_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node ingest-schools.mjs --upsert
 *   4) 로직 검증용 드라이런(모의 데이터, 네트워크 불필요):
 *      node ingest-schools.mjs --mock
 *
 * 출력물:
 *   ./out/schools.json          — 정제 완료된 전체 학교 목록
 *   ./out/ingest-report.json    — 완전성 검증 리포트
 */

import fs from "node:fs";
import path from "node:path";

// ── 설정 ────────────────────────────────────────────────
const NEIS_BASE = "https://open.neis.go.kr/hub/schoolInfo";
const PAGE_SIZE = 1000;              // NEIS 최대 허용치 (ERROR-336: 1,000 초과 불가)
const MAX_PAGES = 20;                // 안전 상한 (고교 ~2,400개 → 3페이지면 충분)
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

// 완전성 검증 기준선 (2026 갱신)
// 원칙: 완전성의 하드 판정은 [총량·NEIS공지건수 일치·지역커버리지·필수필드]로 한다.
//       유형 분포는 정책 변화(자사고 폐지 등)로 정당하게 흔들리므로 '경고'로만 본다.
const BASELINE = {
  totalMin: 2300,
  totalMax: 2600,
  // 2026 참고 분포 — 자사고→일반고 전환 반영(자율고↓·일반고↑). 하드 게이트 아님.
  types: { 일반고: 1640, 특성화고: 490, 특목고: 160, 자율고: 112 },
  typeTolerance: 0.15,               // 경고 임계치. 이 이상 이탈 시 "확인 필요" 안내만
  // 광역자치단체 커버리지 — 반드시 학교가 존재해야 하는 권역 키워드.
  // 2026-07-01 전남광주통합특별시 출범으로 광역단체 17→16개. NEIS는 통합시를
  // '전남광주통합특별시(광주)/(전남)'로 분리표기하므로, 숫자 대신 키워드로 검증한다.
  // NEIS LCTN_SC_NM의 실제 부분문자열 기준 (예: '경상북도'에는 '경북'이 없음 → '경상북')
  requiredRegionKeywords: [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충청북", "충청남", "전북", "전남", "경상북", "경상남", "제주",
  ],
};

const args = new Set(process.argv.slice(2));
const MOCK = args.has("--mock");
const UPSERT = args.has("--upsert");

// ── NEIS 응답 파서 ──────────────────────────────────────
// 정상: { schoolInfo: [ { head:[{list_total_count},{RESULT}] }, { row:[...] } ] }
// 오류/무데이터: { RESULT: { CODE, MESSAGE } }  (INFO-200 = 해당 데이터 없음)
function parseNeisEnvelope(json) {
  if (json.schoolInfo) {
    const head = json.schoolInfo[0]?.head ?? [];
    const totalCount = head.find(h => h.list_total_count !== undefined)?.list_total_count ?? null;
    const result = head.find(h => h.RESULT)?.RESULT ?? null;
    const rows = json.schoolInfo[1]?.row ?? [];
    return { ok: true, totalCount, resultCode: result?.CODE ?? null, rows };
  }
  const code = json.RESULT?.CODE ?? "UNKNOWN";
  if (code === "INFO-200") return { ok: true, totalCount: 0, resultCode: code, rows: [] };
  return { ok: false, resultCode: code, message: json.RESULT?.MESSAGE ?? "알 수 없는 응답 형식", rows: [] };
}

// ── 페이지 fetch (재시도 포함) ──────────────────────────
async function fetchPage(pIndex, fetchImpl) {
  const url = `${NEIS_BASE}?KEY=${process.env.NEIS_KEY ?? "MOCK"}&Type=json&pIndex=${pIndex}&pSize=${PAGE_SIZE}&SCHUL_KND_SC_NM=${encodeURIComponent("고등학교")}`;
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseNeisEnvelope(await res.json());
      if (!parsed.ok) {
        // ERROR-337(일일 트래픽 초과)은 재시도 무의미 → 즉시 중단
        if (parsed.resultCode === "ERROR-337") throw Object.assign(new Error("일일 트래픽 초과 — 내일 재실행 필요"), { fatal: true });
        throw new Error(`NEIS ${parsed.resultCode}: ${parsed.message}`);
      }
      return parsed;
    } catch (err) {
      if (err.fatal || attempt === RETRY_LIMIT) throw err;
      console.warn(`  ⚠ p${pIndex} 시도 ${attempt} 실패(${err.message}) — ${RETRY_DELAY_MS}ms 후 재시도`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
}

// ── 유형 분류 ───────────────────────────────────────────
// 1순위: NEIS HS_SC_NM 필드 (일반고/특성화고/특목고/자율고)
// 2순위: 학교명 휴리스틱 (각종학교·방통고 등 HS_SC_NM 누락분)
export function classifyType(row) {
  const hs = (row.HS_SC_NM ?? "").trim();
  if (["일반고", "특성화고", "특목고", "자율고"].includes(hs)) return hs;
  const name = row.SCHUL_NM ?? "";
  if (/방송통신/.test(name)) return "방송통신고";
  if (/(대안|학력인정)/.test(name)) return "대안·각종학교";
  if (/(과학|외국어|국제|예술|체육|마이스터)고/.test(name)) return "특목고";
  return "기타(각종학교 등)";
}

// ── 정규화 (schools 테이블 스키마와 1:1) ────────────────
function normalize(row) {
  return {
    school_code: row.SD_SCHUL_CODE,               // 커뮤니티 ID = 표준학교코드
    office_code: row.ATPT_OFCDC_SC_CODE,          // 시도교육청코드 (NEIS 하위 API 호출에 필수)
    name: (row.SCHUL_NM ?? "").trim(),
    name_en: (row.ENG_SCHUL_NM ?? "").trim() || null,
    type: classifyType(row),
    sido: (row.LCTN_SC_NM ?? "").trim(),
    address: (row.ORG_RDNMA ?? "").trim() || null,
    homepage: (row.HMPG_ADRES ?? "").trim() || null,
    coedu: (row.COEDU_SC_NM ?? "").trim() || null,
    found_type: (row.FOND_SC_NM ?? "").trim() || null, // 국립/공립/사립
    email_domain: extractDomain(row.HMPG_ADRES),   // 이메일 인증 도메인 대조용(후보)
    synced_at: new Date().toISOString(),
  };
}

function extractDomain(url) {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : `http://${url}`).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

// ── 완전성 검증 ─────────────────────────────────────────
export function assertCompleteness(schools, expectedTotal = null) {
  const hardIssues = [];   // 하나라도 있으면 Gate 2 불통과 (진짜 완전성 문제)
  const warnings = [];     // 완전성과 무관한 참고 사항 (정책·행정 변화 등)
  const byType = {}, bySido = {};
  for (const s of schools) {
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    if (s.sido) bySido[s.sido] = (bySido[s.sido] ?? 0) + 1;
  }

  // [하드] 1) 총량 범위
  if (schools.length < BASELINE.totalMin || schools.length > BASELINE.totalMax)
    hardIssues.push(`총 수집 건수 ${schools.length}건 — 기준 범위 [${BASELINE.totalMin}, ${BASELINE.totalMax}] 벗어남`);

  // [하드] 2) NEIS 공지 총건수와 실수집 일치 (페이지 누락의 직접 증거)
  if (expectedTotal !== null) {
    // 중복 제거분만큼은 차이날 수 있으므로 '수집 ≤ 공지' & 근접만 확인
    if (schools.length > expectedTotal)
      hardIssues.push(`수집(${schools.length}) > NEIS공지(${expectedTotal}) — 중복 제거 로직 점검`);
    else if (expectedTotal - schools.length > expectedTotal * 0.02)
      hardIssues.push(`수집(${schools.length}) < NEIS공지(${expectedTotal}) — 2% 이상 누락, 페이지 순회 점검`);
  }

  // [하드] 3) 권역 커버리지 — 필수 키워드마다 학교 1개 이상
  const sidoKeys = Object.keys(bySido);
  const missingRegions = BASELINE.requiredRegionKeywords.filter(
    kw => !sidoKeys.some(sido => sido.includes(kw))
  );
  if (missingRegions.length)
    hardIssues.push(`권역 누락: ${missingRegions.join(", ")} — 해당 지역 학교 0건`);

  // [하드] 4) 필수 필드 무결성
  const badRows = schools.filter(s => !s.school_code || !s.office_code || !s.name);
  if (badRows.length) hardIssues.push(`필수 필드 누락 ${badRows.length}건`);

  // [경고] 유형 분포 이탈 — 완전성 문제 아님. 정책 변화 모니터링용.
  for (const [type, expected] of Object.entries(BASELINE.types)) {
    const actual = byType[type] ?? 0;
    const deviation = Math.abs(actual - expected) / expected;
    if (deviation > BASELINE.typeTolerance)
      warnings.push(`${type} ${actual}건 — 참고 분포 ${expected}건 대비 ${(deviation * 100).toFixed(1)}% 차이 (정책 전환 가능성)`);
  }
  // [경고] 통합특별시 등 신규 행정구역 감지
  const mergedCity = sidoKeys.filter(k => k.includes("통합특별시"));
  if (mergedCity.length) warnings.push(`행정통합 지역 감지: ${mergedCity.join(", ")} — 지역 필터 UI 반영 필요`);

  return { pass: hardIssues.length === 0, hardIssues, warnings, byType, bySido, total: schools.length };
}

// ── Supabase upsert (REST API, service_role 사용) ──────
async function upsertToSupabase(schools) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/schools?on_conflict=school_code`;
  const CHUNK = 500;
  for (let i = 0; i < schools.length; i += CHUNK) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(schools.slice(i, i + CHUNK)),
    });
    if (!res.ok) throw new Error(`Supabase upsert 실패 (${res.status}): ${await res.text()}`);
    console.log(`  → upsert ${Math.min(i + CHUNK, schools.length)}/${schools.length}`);
  }
}

// ── 메인 ────────────────────────────────────────────────
async function main() {
  if (!MOCK && !process.env.NEIS_KEY) {
    console.error("✗ NEIS_KEY 환경변수가 없습니다. open.neis.go.kr 에서 인증키를 발급받아 설정하세요.");
    process.exit(1);
  }
  const fetchImpl = MOCK ? (await import("./mock-neis.mjs")).mockFetch : fetch;
  console.log(`● 수집 시작 (${MOCK ? "모의 데이터 드라이런" : "NEIS 실서버"})`);

  // 1) 전 페이지 순회
  const raw = [];
  let expectedTotal = null;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const page = await fetchPage(p, fetchImpl);
    if (expectedTotal === null && page.totalCount !== null) expectedTotal = page.totalCount;
    if (page.rows.length === 0) break;
    raw.push(...page.rows);
    console.log(`  p${p}: ${page.rows.length}건 (누적 ${raw.length}${expectedTotal ? ` / 전체 ${expectedTotal}` : ""})`);
    if (page.rows.length < PAGE_SIZE) break; // 마지막 페이지
  }
  if (expectedTotal !== null && raw.length !== expectedTotal)
    console.warn(`⚠ 수집 건수(${raw.length}) ≠ NEIS 공지 총건수(${expectedTotal}) — 페이지 순회 재점검 필요`);

  // 2) 중복 제거 (SD_SCHUL_CODE 기준) + 정규화
  const seen = new Map();
  let dupCount = 0;
  for (const row of raw) {
    const code = row.SD_SCHUL_CODE;
    if (seen.has(code)) { dupCount++; continue; }
    seen.set(code, normalize(row));
  }
  const schools = [...seen.values()];
  console.log(`● 중복 제거: ${dupCount}건 제외 → 최종 ${schools.length}건`);

  // 3) 완전성 검증
  const report = assertCompleteness(schools, expectedTotal);
  console.log(`● 완전성 검증: ${report.pass ? "✅ 통과" : "❌ 불합격"}`);
  report.hardIssues.forEach(i => console.log(`  ✗ [완전성] ${i}`));
  report.warnings.forEach(w => console.log(`  ⚠ [참고] ${w}`));
  console.log(`  유형 분포:`, report.byType);
  console.log(`  지역 커버리지: ${Object.keys(report.bySido).length}개 권역 버킷`);

  // 4) 산출물 저장
  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "schools.json"), JSON.stringify(schools, null, 2));
  fs.writeFileSync(path.join(outDir, "ingest-report.json"), JSON.stringify(report, null, 2));
  console.log(`● 저장 완료: out/schools.json, out/ingest-report.json`);

  // 5) Supabase 적재 (옵션)
  if (UPSERT) {
    if (!report.pass) { console.error("✗ 완전성 검증 불합격 상태에서는 적재하지 않습니다 (Gate 2 원칙)."); process.exit(1); }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요"); process.exit(1);
    }
    console.log("● Supabase 적재 시작");
    await upsertToSupabase(schools);
    console.log("● Supabase 적재 완료");
  }
  console.log(report.pass ? "\n🚪 Gate 2 조건 충족 — 다음 스테이지 진행 가능" : "\n⛔ Gate 2 미충족 — 이슈 해소 후 재실행");
}

main().catch(err => { console.error("✗ 치명적 오류:", err.message); process.exit(1); });
