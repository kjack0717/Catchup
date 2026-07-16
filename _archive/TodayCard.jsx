// TodayCard.jsx — 홈 화면 "매일 여는 훅"
// 오전 급식 푸시 → 진입 → 이 카드가 첫 화면. 급식·D-day가 재방문의 이유.
//
// 실사용:  <TodayCard schoolName="상록고" meals={meals} ddays={ddays} />
// 데이터 미주입 시 데모 데이터로 렌더 (미리보기·개발용).

import React from "react";
import { ddayLabel, sortMeals } from "./neis-format";

// ── 데모 데이터 (props 미주입 시) ─────────────────────────
const DEMO_MEALS = [
  { type: "중식", menu: ["차수수밥", "순두부찌개", "제육볶음", "청경채겉절이", "깍두기", "요구르트"], kcal: 892 },
  { type: "석식", menu: ["백미밥", "어묵국", "치킨마요덮밥", "단무지무침", "배추김치"], kcal: 743 },
];
const DEMO_DDAYS = [
  { name: "1학기 기말고사", d: 12, kind: "exam" },
  { name: "전국연합학력평가", d: 40, kind: "mock" },
  { name: "2027학년도 수능", d: 133, kind: "suneung" },
];

const CSS = `
:root{
  --ink:#17233D; --sub:#69718A; --paper:#EEF0F4; --card:#FFFFFF;
  --hl:#FFE14A; --hl-deep:#F5C800; --stamp:#D6402B; --line:#DCE0E8; --ok:#1F9D55;
  --disp:'Do Hyeon',sans-serif;
  --body:'IBM Plex Sans KR','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
}
.tc-wrap{font-family:var(--body);color:var(--ink);max-width:440px;margin:0 auto;padding:18px}
.tc-hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.tc-school{font-family:var(--disp);font-size:20px}
.tc-date{font-size:12.5px;color:var(--sub)}

.tc-card{background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:12px}
.tc-label{font-size:12px;font-weight:700;color:var(--sub);letter-spacing:.4px;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.tc-label .em{font-size:15px}

/* 급식 */
.tc-meal + .tc-meal{margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
.tc-meal-hd{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.tc-meal-tag{font-size:11.5px;font-weight:700;color:var(--ink);background:var(--hl);padding:2px 9px;border-radius:999px}
.tc-kcal{font-size:11.5px;color:var(--sub)}
.tc-menu{display:flex;flex-wrap:wrap;gap:6px}
.tc-dish{font-size:13.5px;background:var(--paper);padding:5px 10px;border-radius:8px}
.tc-empty{font-size:13.5px;color:var(--sub);padding:6px 0}

/* D-day */
.tc-dday{display:flex;align-items:center;gap:12px}
.tc-dday + .tc-dday{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.tc-dnum{flex:0 0 auto;min-width:58px;text-align:center;font-family:var(--disp);font-size:19px;
  padding:8px 6px;border-radius:10px;line-height:1}
.tc-dnum.suneung{background:var(--stamp);color:#fff}
.tc-dnum.exam{background:var(--ink);color:#fff}
.tc-dnum.mock{background:var(--paper);color:var(--ink);border:1.5px solid var(--line)}
.tc-dname{font-size:14.5px;font-weight:600}
.tc-dsub{font-size:11.5px;color:var(--sub);margin-top:2px}
`;

function todayLabel() {
  const d = new Date();
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

export default function TodayCard({
  schoolName = "우리 학교",
  meals = DEMO_MEALS,
  ddays = DEMO_DDAYS,
}) {
  const sorted = sortMeals(meals);
  const nearest = [...ddays].sort((a, b) => a.d - b.d).slice(0, 4);

  return (
    <div className="tc-wrap">
      <style>{CSS}</style>
      <div className="tc-hd">
        <div className="tc-school">{schoolName}</div>
        <div className="tc-date">{todayLabel()}</div>
      </div>

      {/* 급식 카드 */}
      <div className="tc-card">
        <div className="tc-label"><span className="em">🍚</span> 오늘의 급식</div>
        {sorted.length === 0 ? (
          <div className="tc-empty">오늘은 급식 정보가 없어요 (주말·방학일 수 있어요)</div>
        ) : (
          sorted.map((m, i) => (
            <div className="tc-meal" key={i}>
              <div className="tc-meal-hd">
                <span className="tc-meal-tag">{m.type}</span>
                {m.kcal && <span className="tc-kcal">{m.kcal} kcal</span>}
              </div>
              <div className="tc-menu">
                {m.menu.map((dish, j) => <span className="tc-dish" key={j}>{dish}</span>)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* D-day 카드 */}
      <div className="tc-card">
        <div className="tc-label"><span className="em">📅</span> 다가오는 D-day</div>
        {nearest.length === 0 ? (
          <div className="tc-empty">예정된 시험 일정이 없어요</div>
        ) : (
          nearest.map((e, i) => (
            <div className="tc-dday" key={i}>
              <div className={`tc-dnum ${e.kind || "exam"}`}>{ddayLabel(e.d)}</div>
              <div>
                <div className="tc-dname">{e.name}</div>
                <div className="tc-dsub">
                  {e.kind === "suneung" ? "국가 지정 시험" : e.kind === "mock" ? "모의고사" : "교내 지필평가"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
