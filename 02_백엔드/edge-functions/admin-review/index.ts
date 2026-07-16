// admin-review/index.ts — Supabase Edge Function: 검수 어드민 백엔드
// ─────────────────────────────────────────────────────
// 화면(브라우저)은 이 함수만 호출한다. service_role은 이 안에만 존재.
// 액션:
//   { action: "list" }                                  → 검수 큐 + 학생증 서명URL(5분)
//   { action: "decide", request_id, approve, reason? }  → 승인/거절 + 이미지 파기
//
// 배포: supabase functions deploy admin-review
// (SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY는 자동 주입)

import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const BUCKET = "student-ids";
const SIGN_TTL = 300; // 서명 URL 유효 5분

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST만 허용" }, 405);

    // ── 관리자 인증 ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "로그인이 필요합니다" }, 401);

    const { data: isAdmin } = await admin
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isAdmin) return json({ error: "관리자 권한이 없습니다" }, 403);

    const body = await req.json();

    // ── list: 검수 큐 + 서명 URL ──
    if (body.action === "list") {
      const { data: rows, error } = await admin
        .from("v_review_queue").select("*").limit(50);
      if (error) throw new Error(error.message);

      const items = await Promise.all((rows ?? []).map(async (r) => {
        const { data: signed } = await admin
          .storage.from(BUCKET).createSignedUrl(r.image_path, SIGN_TTL);
        return {
          id: r.id,
          school_name: r.school_name,
          sido: r.sido,
          ocr_school_name: r.ocr_school_name,
          ocr_confidence: r.ocr_confidence,
          created_at: r.created_at,
          image_url: signed?.signedUrl ?? null,
        };
      }));
      return json({ items });
    }

    // ── decide: 승인/거절 ──
    if (body.action === "decide") {
      const { request_id, approve, reason } = body;
      if (!request_id || typeof approve !== "boolean")
        return json({ error: "request_id, approve 필요" }, 400);

      // 저장된 identity_hash를 읽어 차단검사에 넘긴다 (정지자·중복 방지)
      const { data: row } = await admin
        .from("verification_requests")
        .select("identity_hash, image_path, status").eq("id", request_id).single();
      if (!row) return json({ error: "요청 없음" }, 404);
      if (row.status !== "pending") return json({ error: "이미 처리됨" }, 409);

      const { error: rpcErr } = await admin.rpc("decide_verification", {
        p_request_id: request_id,
        p_approve: approve,
        p_decided_by: "admin",
        p_identity_hash: row.identity_hash,        // 저장된 해시로 차단검사 수행
        p_reject_reason: approve ? null : (reason ?? "관리자 검토 결과 재학 확인 불가"),
      });
      if (rpcErr) throw new Error(rpcErr.message);

      // 결정 완료 → 이미지 파기 (검수 경로는 이미지가 남아있음)
      await admin.storage.from(BUCKET).remove([row.image_path]);
      await admin.rpc("mark_image_purged", { p_request_id: request_id });

      const { data: fin } = await admin
        .from("verification_requests").select("status, reject_reason")
        .eq("id", request_id).single();
      return json({ status: fin?.status, reject_reason: fin?.reject_reason });
    }

    return json({ error: "알 수 없는 action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "처리 중 문제가 발생했습니다" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
