// supabaseClient.js — Catchup 앱의 단일 Supabase 연결점
// ⚠️ 반드시 anon(public) 키만 사용한다. service_role 키는 절대 앱에 넣지 않는다.
//    (service_role은 RLS를 무시하므로 노출되면 전체 학교 격리가 무너진다.)

import { createClient } from "@supabase/supabase-js";

// 환경변수 이름은 번들러에 맞춰 하나를 사용:
//  - Vite:  import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//  - Expo:  process.env.EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // 설정 누락은 조용히 넘기지 않고 명확히 알린다.
  console.error(
    "[Catchup] Supabase 환경변수가 없습니다. .env에 SUPABASE URL과 anon 키를 설정하세요."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
