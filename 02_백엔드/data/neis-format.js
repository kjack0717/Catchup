// neis-format.js — 급식·학사일정 표시용 순수 함수 (브라우저/노드 공용)

// 급식 메뉴 정제: "자장소스(구리고)2.5.6.<br/>얼큰짬뽕5.6." → ["자장소스","얼큰짬뽕"]
export function cleanMenu(ddishNm) {
  if (!ddishNm) return [];
  return ddishNm
    .split(/<br\s*\/?>/i)
    .map(s => s.replace(/\([^)]*\)/g, "").replace(/[0-9.]+/g, "").trim())
    .filter(Boolean);
}

export function calKcal(calInfo) {
  const m = (calInfo ?? "").match(/([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

// D-day 계산 (오늘 → 대상일). 'YYYYMMDD' 또는 'YYYY-MM-DD' 모두 허용
export function computeDday(toYmd, from = new Date()) {
  const s = String(toYmd).replace(/-/g, "");
  const target = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / 86400000);
}

// D-day 라벨: 0 → "D-DAY", 양수 → "D-n"
export function ddayLabel(n) {
  return n === 0 ? "D-DAY" : `D-${n}`;
}

export const MEAL_ORDER = { 조식: 0, 중식: 1, 석식: 2 };
export function sortMeals(meals) {
  return [...meals].sort((a, b) => (MEAL_ORDER[a.type] ?? 9) - (MEAL_ORDER[b.type] ?? 9));
}
