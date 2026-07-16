// SchoolSearch.jsx — 온보딩 "학교 찾기" 화면
// 실데이터(2,404개) 위에서 실시간 검색된다. searchFn 미주입 시 실제 Supabase RPC를 호출.
//
// 사용 예:
//   import SchoolSearch from "./SchoolSearch";
//   <SchoolSearch onSelect={(school) => goToVerify(school)} />

import React, { useEffect, useRef, useState, useCallback } from "react";
import { searchSchools as defaultSearch, prettyRegion, TYPE_BADGE } from "./schools-api";

const CSS = `
:root{
  --ink:#17233D; --sub:#69718A; --paper:#EEF0F4; --card:#FFFFFF;
  --hl:#FFE14A; --hl-deep:#F5C800; --stamp:#D6402B; --line:#DCE0E8; --ok:#1F9D55;
  --disp:'Do Hyeon',sans-serif;
  --body:'IBM Plex Sans KR','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
}
.ss-wrap{font-family:var(--body);color:var(--ink);max-width:440px;margin:0 auto;padding:20px 18px}
.ss-h1{font-family:var(--disp);font-size:26px;line-height:1.3}
.ss-h1 mark{background:linear-gradient(transparent 55%,var(--hl) 55%);padding:0 3px}
.ss-sub{color:var(--sub);font-size:13.5px;margin-top:6px}
.ss-field{position:relative;margin-top:18px}
.ss-input{width:100%;padding:14px 42px 14px 16px;border:2px solid var(--line);border-radius:12px;
  font-size:15.5px;font-family:var(--body);background:var(--card);transition:border-color .15s}
.ss-input:focus{outline:none;border-color:var(--hl-deep)}
.ss-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:none;background:none;
  color:var(--sub);font-size:18px;cursor:pointer;padding:6px;line-height:1}
.ss-status{margin-top:14px;font-size:13.5px;color:var(--sub);text-align:center;padding:22px 0}
.ss-status.err{color:var(--stamp)}
.ss-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.ss-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--card);
  border:1.5px solid var(--line);border-radius:12px;padding:13px 14px;cursor:pointer;transition:border-color .12s,transform .06s}
.ss-item:hover{border-color:var(--hl-deep)}
.ss-item:active{transform:scale(.99)}
.ss-item:focus-visible{outline:3px solid var(--hl-deep);outline-offset:2px}
.ss-region{flex:0 0 auto;min-width:44px;height:44px;border-radius:10px;background:var(--paper);
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--ink)}
.ss-main{flex:1;min-width:0}
.ss-name{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-meta{display:flex;align-items:center;gap:6px;margin-top:3px}
.ss-badge{font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;border:1px solid var(--line)}
.ss-badge.green{color:#12784a;border-color:#bfe6cf;background:#eafaf0}
.ss-badge.blue{color:#1450a0;border-color:#c5daf5;background:#eef4fd}
.ss-badge.amber{color:#9a6b00;border-color:#f0dfa8;background:#fdf7e3}
.ss-badge.neutral{color:var(--sub)}
.ss-open{font-size:11px;color:var(--ok);font-weight:600}
.ss-wait{font-size:11px;color:var(--sub)}
.ss-addr{font-size:12px;color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (prefers-reduced-motion:reduce){.ss-item{transition:none}}
`;

const DEBOUNCE_MS = 280;

export default function SchoolSearch({ onSelect, searchFn = defaultSearch }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [state, setState] = useState("idle"); // idle | loading | done | error | empty
  const [errMsg, setErrMsg] = useState("");
  const timer = useRef(null);
  const reqId = useRef(0); // 경쟁 조건 방지: 마지막 요청 결과만 반영

  const run = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setState("idle"); return; }
    const myId = ++reqId.current;
    setState("loading");
    try {
      const data = await searchFn(trimmed, { limit: 20 });
      if (myId !== reqId.current) return;       // 더 최신 검색이 있으면 폐기
      setResults(data);
      setState(data.length ? "done" : "empty");
    } catch (e) {
      if (myId !== reqId.current) return;
      setErrMsg(e.message || "검색 중 문제가 발생했습니다.");
      setState("error");
    }
  }, [searchFn]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(query), DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [query, run]);

  return (
    <div className="ss-wrap">
      <style>{CSS}</style>
      <h1 className="ss-h1">우리 학교를 <mark>찾아보자</mark></h1>
      <p className="ss-sub">학교 이름이나 지역으로 검색하세요. 예: 상록고, 광주, 서울과학</p>

      <div className="ss-field">
        <input
          className="ss-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학교명 또는 지역 입력"
          aria-label="학교 검색"
          autoFocus
        />
        {query && (
          <button className="ss-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>
        )}
      </div>

      {state === "loading" && <div className="ss-status">찾는 중…</div>}
      {state === "empty" && (
        <div className="ss-status">
          '{query.trim()}'에 해당하는 학교가 없어요.<br />학교명 일부나 지역명으로 다시 검색해 보세요.
        </div>
      )}
      {state === "error" && <div className="ss-status err">{errMsg}</div>}
      {state === "idle" && <div className="ss-status">검색어를 입력하면 전국 고등학교에서 찾아드려요.</div>}

      {state === "done" && (
        <div className="ss-list">
          {results.map((s) => {
            const badge = TYPE_BADGE[s.type] || { label: s.type, tone: "neutral" };
            return (
              <button
                key={s.school_code}
                className="ss-item"
                onClick={() => onSelect?.(s)}
              >
                <div className="ss-region">{prettyRegion(s.sido)}</div>
                <div className="ss-main">
                  <div className="ss-name">{s.name}</div>
                  <div className="ss-meta">
                    <span className={`ss-badge ${badge.tone}`}>{badge.label}</span>
                    {s.is_open
                      ? <span className="ss-open">● 커뮤니티 열림</span>
                      : <span className="ss-wait">개설 대기</span>}
                  </div>
                  {s.address && <div className="ss-addr">{s.address}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
