// AdminReview.jsx — 검수 어드민 페이지 (Stage 3-8)
// v_review_queue의 pending 요청을 사람이 승인/거절한다.
// 모든 권한 작업은 admin-review Edge Function 뒤에 있음(service_role 노출 없음).
//
// 실사용: <AdminReview />  (supabase 세션 필요, 관리자 계정)
// 프리뷰/테스트: <AdminReview api={mockApi} />

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// 기본 API: admin-review Edge Function 호출
const defaultApi = {
  async list() {
    const { data, error } = await supabase.functions.invoke("admin-review", { body: { action: "list" } });
    if (error) throw error;
    return data.items ?? [];
  },
  async decide(request_id, approve, reason) {
    const { data, error } = await supabase.functions.invoke("admin-review", {
      body: { action: "decide", request_id, approve, reason },
    });
    if (error) throw error;
    return data;
  },
};

const CSS = `
:root{
  --ink:#17233D; --sub:#69718A; --paper:#EEF0F4; --card:#FFFFFF;
  --hl:#FFE14A; --hl-deep:#F5C800; --stamp:#D6402B; --line:#DCE0E8; --ok:#1F9D55;
  --disp:'Do Hyeon',sans-serif; --body:'IBM Plex Sans KR','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
}
.ar-wrap{font-family:var(--body);color:var(--ink);max-width:720px;margin:0 auto;padding:20px}
.ar-hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px}
.ar-title{font-family:var(--disp);font-size:22px}
.ar-count{font-size:13px;color:var(--sub)}
.ar-refresh{border:1.5px solid var(--line);background:var(--card);border-radius:9px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer}
.ar-refresh:hover{border-color:var(--hl-deep)}
.ar-empty{text-align:center;color:var(--sub);padding:48px 0;font-size:14px}
.ar-msg{padding:10px 14px;border-radius:9px;font-size:13px;margin-bottom:12px}
.ar-msg.ok{background:#eafaf0;color:#12784a}
.ar-msg.err{background:#fdecea;color:var(--stamp)}
.ar-card{display:flex;gap:14px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.ar-img{flex:0 0 128px;width:128px;height:128px;border-radius:10px;object-fit:cover;background:var(--paper);border:1px solid var(--line)}
.ar-body{flex:1;min-width:0}
.ar-school{font-size:15px;font-weight:700}
.ar-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;color:var(--sub)}
.ar-chip{background:var(--paper);padding:3px 9px;border-radius:999px}
.ar-chip.warn{background:#fdf7e3;color:#9a6b00}
.ar-chip.ok{background:#eafaf0;color:#12784a}
.ar-actions{display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap}
.ar-btn{border:none;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer}
.ar-approve{background:var(--ok);color:#fff}
.ar-reject{background:var(--card);color:var(--stamp);border:1.5px solid var(--stamp)}
.ar-btn:disabled{opacity:.5;cursor:default}
.ar-reason{flex:1;min-width:160px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:13px;font-family:var(--body)}
`;

function confChip(c) {
  if (c == null) return <span className="ar-chip warn">신뢰도 미측정</span>;
  const cls = c >= 0.85 ? "ok" : "warn";
  return <span className={`ar-chip ${cls}`}>OCR {(c * 100).toFixed(0)}%</span>;
}

export default function AdminReview({ api = defaultApi }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reasons, setReasons] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try { setItems(await api.list()); }
    catch (e) { setMsg({ type: "err", text: e.message || "목록을 불러오지 못했습니다" }); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function decide(id, approve) {
    if (!approve && !(reasons[id] || "").trim()) {
      setMsg({ type: "err", text: "거절 사유를 입력해 주세요" }); return;
    }
    setBusyId(id); setMsg(null);
    try {
      const res = await api.decide(id, approve, reasons[id]);
      setItems(prev => prev.filter(x => x.id !== id));
      setMsg({ type: "ok", text: approve ? "승인 처리했습니다" : "거절 처리했습니다" });
    } catch (e) {
      setMsg({ type: "err", text: e.message || "처리에 실패했습니다" });
    } finally { setBusyId(null); }
  }

  return (
    <div className="ar-wrap">
      <style>{CSS}</style>
      <div className="ar-hd">
        <div>
          <div className="ar-title">재학인증 검수 큐</div>
          <div className="ar-count">{loading ? "불러오는 중…" : `검토 대기 ${items.length}건`}</div>
        </div>
        <button className="ar-refresh" onClick={load} disabled={loading}>새로고침</button>
      </div>

      {msg && <div className={`ar-msg ${msg.type}`}>{msg.text}</div>}

      {!loading && items.length === 0 ? (
        <div className="ar-empty">검토할 요청이 없습니다. 모두 처리됐어요.</div>
      ) : (
        items.map((it) => (
          <div className="ar-card" key={it.id}>
            {it.image_url
              ? <img className="ar-img" src={it.image_url} alt="학생증" />
              : <div className="ar-img" />}
            <div className="ar-body">
              <div className="ar-school">{it.school_name}</div>
              <div className="ar-row">
                <span className="ar-chip">{it.sido}</span>
                {confChip(it.ocr_confidence)}
                <span className="ar-chip">OCR 학교명: {it.ocr_school_name || "미추출"}</span>
              </div>
              <div className="ar-actions">
                <button className="ar-btn ar-approve" disabled={busyId === it.id}
                  onClick={() => decide(it.id, true)}>승인</button>
                <input className="ar-reason" placeholder="거절 사유 (거절 시 필수)"
                  value={reasons[it.id] || ""}
                  onChange={(e) => setReasons(r => ({ ...r, [it.id]: e.target.value }))} />
                <button className="ar-btn ar-reject" disabled={busyId === it.id}
                  onClick={() => decide(it.id, false)}>거절</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
