#!/usr/bin/env node
/**
 * Catchup — Stage 4-A: 코어기능(급식·D-day) 검증 스크립트
 * ─────────────────────────────────────────────────────
 * 수집한 학교(office_code + school_code)로 NEIS 급식·학사일정을 실제 호출하여
 * 오늘의 급식과 시험/수능 D-day를 계산해 출력한다.
 *
 * 실행:
 *   # out/schools.json의 첫 학교로 오늘 급식·D-day 확인
 *   NEIS_KEY=발급키 node neis-core.mjs
 *
 *   # 특정 학교로 확인 (이름 일부로 검색)
 *   NEIS_KEY=발급키 SCHOOL_NAME=상록고 node neis-core.mjs
 *
 *   # 네트워크 없이 로직만 검증
 *   node neis-core.mjs --mock
 */

import fs from "node:fs";
import path from "node:path";

const HUB = "https://open.neis.go.kr/hub";
const MOCK = process.argv.includes("--mock");

// ── 수능 D-day (국가 고정일) ─────────────────────────────
// ⚠️ 2027학년도 수능 예상일. 한국교육과정평가원 공식 공고로 반드시 확정할 것.
//    (수능은 통상 11월 셋째 주 목요일이나, 해에 따라 이동한 사례가 있음)
const SUNEUNG = { name: "2027학년도 수능", date: "2026-11-19" };

// 학사일정에서 D-day로 뽑을 이벤트 키워드
const EXAM_KEYWORDS = /(중간고사|기말고사|지필|평가|모의고사|수능)/;

// ── 날짜 유틸 ────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function today() { return new Date(); }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function lastOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 2, 0); } // 이번+다음달
function dday(fromDate, toYmd) {
  const y = +toYmd.slice(0, 4), m = +toYmd.slice(4, 6), dd = +toYmd.slice(6, 8);
  const target = new Date(y, m - 1, dd);
  const base = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  return Math.round((target - base) / 86400000);
}

// ── NEIS 호출 ────────────────────────────────────────────
async function neis(endpoint, params, fetchImpl) {
  const qs = new URLSearchParams({
    KEY: process.env.NEIS_KEY ?? "MOCK", Type: "json", pIndex: "1", pSize: "100", ...params,
  });
  const res = await fetchImpl(`${HUB}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const key = Object.keys(json).find(k => k !== "RESULT");
  if (!json[key] || json[key].RESULT) {
    // 데이터 없음(INFO-200)은 정상 — 빈 배열 반환
    return [];
  }
  return json[key][1]?.row ?? [];
}

// ── 급식 메뉴 정제 ───────────────────────────────────────
// "자장소스(구리고)2.5.6.10.13.16.<br/>얼큰짬뽕(구리고)5.6.9.13." →
//   ["자장소스", "얼큰짬뽕"]  (학교 약칭·알레르기 번호 제거)
function cleanMenu(ddishNm) {
  if (!ddishNm) return [];
  return ddishNm
    .split(/<br\s*\/?>/i)
    .map(s => s
      .replace(/\([^)]*\)/g, "")     // (구리고) 같은 괄호 제거
      .replace(/[0-9.]+/g, "")       // 알레르기 유발물질 번호 제거
      .trim())
    .filter(Boolean);
}
function calKcal(calInfo) {
  const m = (calInfo ?? "").match(/([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}
const MEAL_ORDER = { 조식: 0, 중식: 1, 석식: 2 };

// ── 메인 ────────────────────────────────────────────────
async function main() {
  const fetchImpl = MOCK ? (await import("./mock-neis-core.mjs")).mockFetch : fetch;
  if (!MOCK && !process.env.NEIS_KEY) {
    console.error("✗ NEIS_KEY 환경변수가 없습니다."); process.exit(1);
  }

  // 대상 학교 선택 (out/schools.json 재사용)
  let school;
  if (MOCK) {
    school = { name: "모의고등학교", office_code: "J10", school_code: "7530054", sido: "경기도" };
  } else {
    const p = path.join(process.cwd(), "out", "schools.json");
    if (!fs.existsSync(p)) { console.error("✗ out/schools.json이 없습니다. 먼저 ingest-schools.mjs를 실행하세요."); process.exit(1); }
    const all = JSON.parse(fs.readFileSync(p, "utf8"));
    const filter = process.env.SCHOOL_NAME;
    school = filter ? all.find(s => s.name.includes(filter)) : all.find(s => s.type === "일반고");
    if (!school) { console.error(`✗ '${filter}' 학교를 찾을 수 없습니다.`); process.exit(1); }
  }
  console.log(`● 대상 학교: ${school.name} (${school.sido})  [${school.office_code}/${school.school_code}]\n`);

  const now = today();
  const common = { ATPT_OFCDC_SC_CODE: school.office_code, SD_SCHUL_CODE: school.school_code };

  // 1) 오늘의 급식
  const meals = await neis("mealServiceDietInfo", { ...common, MLSV_YMD: ymd(now) }, fetchImpl);
  console.log(`🍚 오늘의 급식 (${now.getMonth() + 1}/${now.getDate()})`);
  if (meals.length === 0) {
    console.log("   급식 정보 없음 (주말·방학·미등록일 수 있음)\n");
  } else {
    meals.sort((a, b) => (MEAL_ORDER[a.MMEAL_SC_NM] ?? 9) - (MEAL_ORDER[b.MMEAL_SC_NM] ?? 9));
    for (const m of meals) {
      const menu = cleanMenu(m.DDISH_NM);
      const kcal = calKcal(m.CAL_INFO);
      console.log(`   [${m.MMEAL_SC_NM}] ${menu.join(" · ")}${kcal ? `  (${kcal} kcal)` : ""}`);
    }
    console.log("");
  }

  // 2) 학사일정 → 시험/수능 D-day
  const sched = await neis("SchoolSchedule", {
    ...common, AA_FROM_YMD: ymd(firstOfMonth(now)), AA_TO_YMD: ymd(lastOfMonth(now)),
  }, fetchImpl);

  const examEvents = sched
    .filter(e => EXAM_KEYWORDS.test(e.EVENT_NM ?? ""))
    .map(e => ({ name: e.EVENT_NM, d: dday(now, e.AA_YMD), ymd: e.AA_YMD }))
    .filter(e => e.d >= 0)
    .sort((a, b) => a.d - b.d);

  console.log("📅 D-day");
  const suneungD = dday(now, SUNEUNG.date.replace(/-/g, ""));
  if (suneungD >= 0) console.log(`   D-${suneungD}  ${SUNEUNG.name}`);
  if (examEvents.length === 0) {
    console.log("   이번·다음 달 시험 일정 없음");
  } else {
    for (const e of examEvents.slice(0, 5)) {
      console.log(`   D-${e.d === 0 ? "DAY" : e.d}  ${e.name} (${e.ymd.slice(4, 6)}/${e.ymd.slice(6, 8)})`);
    }
  }
  console.log("\n✅ 코어기능 검증 완료 — 급식·D-day가 실데이터로 동작");
}

main().catch(e => { console.error("✗ 오류:", e.message); process.exit(1); });
