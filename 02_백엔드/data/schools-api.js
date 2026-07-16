// schools-api.js — 학교 검색/조회 API 래퍼
// 앱 화면은 이 모듈만 import 한다. Supabase 세부사항은 여기 안에 가둔다.

import { supabase } from "./supabaseClient";

/**
 * 학교 검색 (온보딩 "학교 찾기")
 * @param {string} query 검색어 (학교명 또는 지역명)
 * @param {{limit?: number}} opts
 * @returns {Promise<Array>} 학교 목록 (빈 검색어면 빈 배열)
 */
export async function searchSchools(query, { limit = 20 } = {}) {
  const q = (query ?? "").trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_schools", {
    q,
    max_results: limit,
  });

  if (error) {
    // 화면에서 사용자에게 방향을 제시할 수 있도록 그대로 던진다.
    throw new Error(`학교 검색에 실패했습니다: ${error.message}`);
  }
  return data ?? [];
}

/**
 * 단일 학교 조회 (인증 화면 등에서 school_code로 확정된 학교 정보 표시)
 */
export async function getSchool(schoolCode) {
  const { data, error } = await supabase
    .from("schools")
    .select("school_code, name, name_en, type, sido, address, is_open")
    .eq("school_code", schoolCode)
    .single();
  if (error) throw new Error(`학교 정보를 불러오지 못했습니다: ${error.message}`);
  return data;
}

// ── 지역명 표시 헬퍼 ─────────────────────────────────────────
// NEIS는 통합특별시를 '전남광주통합특별시(광주)'처럼 내려준다.
// 학생에게는 익숙한 '광주' 같은 짧은 이름을 뱃지로 보여주는 게 낫다.
export function prettyRegion(sido) {
  if (!sido) return "";
  const m = sido.match(/\(([^)]+)\)/); // 괄호 안 지역 추출: '전남광주통합특별시(광주)' → '광주'
  if (m) return m[1];
  // 접미사 정리: '서울특별시'→'서울', '경상북도'→'경북' 수준의 축약
  return sido
    .replace(/특별자치도$/, "")
    .replace(/특별자치시$/, "")
    .replace(/특별시$/, "")
    .replace(/광역시$/, "")
    .replace(/도$/, "");
}

// 유형 뱃지 색상 힌트 (컴포넌트에서 사용)
export const TYPE_BADGE = {
  일반고: { label: "일반고", tone: "neutral" },
  특성화고: { label: "특성화고", tone: "green" },
  특목고: { label: "특목고", tone: "blue" },
  자율고: { label: "자율고", tone: "amber" },
  방송통신고: { label: "방송통신고", tone: "neutral" },
  "대안·각종학교": { label: "대안학교", tone: "neutral" },
};
