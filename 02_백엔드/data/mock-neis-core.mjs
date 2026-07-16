/**
 * 모의 NEIS 서버 — neis-core.mjs --mock 전용
 * 급식(mealServiceDietInfo)과 학사일정(SchoolSchedule) 실제 응답 형식을 재현.
 */

function envelope(name, rows) {
  if (rows.length === 0)
    return { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } };
  return {
    [name]: [
      { head: [{ list_total_count: rows.length }, { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } }] },
      { row: rows },
    ],
  };
}

// 오늘 날짜 기준으로 시험 일정을 며칠 뒤로 배치
const pad = (n) => String(n).padStart(2, "0");
function ymdAfter(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

const MEALS = [
  { MMEAL_SC_NM: "중식", DDISH_NM: "차수수밥(모의)<br/>순두부찌개(모의)5.6.<br/>제육볶음(모의)2.5.6.10.<br/>청경채겉절이(모의)<br/>깍두기(모의)9.<br/>요구르트(모의)2.", CAL_INFO: "892.0 Kcal" },
  { MMEAL_SC_NM: "석식", DDISH_NM: "백미밥(모의)<br/>어묵국(모의)1.5.6.<br/>치킨마요덮밥(모의)1.2.5.<br/>단무지무침(모의)<br/>배추김치(모의)9.", CAL_INFO: "743.0 Kcal" },
];

const SCHEDULE = [
  { EVENT_NM: "1학기 기말고사", AA_YMD: ymdAfter(12) },
  { EVENT_NM: "여름방학식",     AA_YMD: ymdAfter(25) },
  { EVENT_NM: "전국연합학력평가", AA_YMD: ymdAfter(40) },
];

export async function mockFetch(url) {
  const u = new URL(url);
  const endpoint = u.pathname.split("/").pop();
  let body;
  if (endpoint === "mealServiceDietInfo") body = envelope("mealServiceDietInfo", MEALS);
  else if (endpoint === "SchoolSchedule") body = envelope("SchoolSchedule", SCHEDULE);
  else body = { RESULT: { CODE: "INFO-200", MESSAGE: "없음" } };
  return { ok: true, json: async () => body };
}
