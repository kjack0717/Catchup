// logic.ts — 학생증 인증 판정 순수 로직 (Deno Edge Function + 테스트 공용)
// 외부 의존 없음. WebCrypto만 사용 (Deno/Node 22+ 모두 내장).

// ── 정규화 ───────────────────────────────────────────────
// 학교명 비교 전 잡음 제거: 공백·괄호·'등학교' 축약 차이 흡수
export function normalizeSchoolName(s: string): string {
  return (s ?? "")
    .replace(/\s+/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/등학교$/, "")     // '고등학교' → '고' 로 끝나게
    .trim();
}

export function normalizePersonName(s: string): string {
  return (s ?? "").replace(/\s+/g, "").trim();
}

// ── 학교명 대조 ──────────────────────────────────────────
// OCR 학교명 vs 사용자가 선택한 학교명. 완전일치 / 포함 / 불일치 3단계.
export type SchoolMatch = "exact" | "partial" | "mismatch";
export function matchSchoolName(ocrName: string, selectedName: string): SchoolMatch {
  const a = normalizeSchoolName(ocrName);
  const b = normalizeSchoolName(selectedName);
  if (!a || !b) return "mismatch";
  if (a === b) return "exact";
  if (a.includes(b) || b.includes(a)) return "partial";
  return "mismatch";
}

// ── 발급년도 검사 — 졸업생 위장 방지 단서 ─────────────────
// 고교 3년제: 올해 기준 (currentYear - 2) 이전 발급이면 재학 가능성 낮음 → 사람 검수
export function issueYearOk(issueYear: number | null, currentYear: number): boolean | null {
  if (issueYear == null || Number.isNaN(issueYear)) return null; // 판단 불가
  return issueYear >= currentYear - 2 && issueYear <= currentYear;
}

// ── 자동 승인 판정 ───────────────────────────────────────
// 원칙: 자동 승인은 보수적으로, 애매하면 전부 사람 검수(pending 유지).
export type AutoDecision =
  | { action: "auto_approve" }
  | { action: "review"; reason: string }
  | { action: "auto_reject"; reason: string };

export function decideAuto(input: {
  match: SchoolMatch;
  ocrConfidence: number;        // 0~1
  issueYearCheck: boolean | null;
  hasStudentName: boolean;
}): AutoDecision {
  const { match, ocrConfidence, issueYearCheck, hasStudentName } = input;

  // 학교명이 아예 다르면 자동 거절 (오업로드·타교 학생증)
  if (match === "mismatch")
    return { action: "auto_reject", reason: "학생증의 학교명이 선택한 학교와 다릅니다. 본인 학교를 다시 선택해 주세요." };

  // 자동 승인 요건: 완전일치 + 고신뢰 + 이름 추출됨 + 발급년도 이상 없음
  if (match === "exact" && ocrConfidence >= 0.85 && hasStudentName && issueYearCheck !== false)
    return { action: "auto_approve" };

  // 나머지는 전부 사람 검수
  const reasons: string[] = [];
  if (match === "partial") reasons.push("학교명 부분일치");
  if (ocrConfidence < 0.85) reasons.push(`OCR 신뢰도 낮음(${ocrConfidence.toFixed(2)})`);
  if (!hasStudentName) reasons.push("이름 미추출");
  if (issueYearCheck === false) reasons.push("발급년도 오래됨(졸업생 가능성)");
  if (issueYearCheck === null) reasons.push("발급년도 미확인");
  return { action: "review", reason: reasons.join(", ") };
}

// ── identity_hash — HMAC-SHA256(정규화 seed, pepper) ─────
// seed = 정규화이름|학교코드. 원문은 어디에도 저장하지 않는다.
export async function identityHash(
  studentName: string,
  schoolCode: string,
  pepper: string,
): Promise<string> {
  const seed = `${normalizePersonName(studentName)}|${schoolCode}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(seed));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── OCR 텍스트에서 필드 추출 ─────────────────────────────
// CLOVA 일반 OCR은 필드 배열을 주므로, 텍스트 라인들에서 규칙 기반 추출.
export function extractFields(lines: string[]): {
  schoolName: string | null; studentName: string | null; issueYear: number | null;
} {
  let schoolName: string | null = null;
  let studentName: string | null = null;
  let issueYear: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    // 학교명: 'XX고등학교' 패턴 (가장 긴 후보 채택)
    const sm = line.match(/[가-힣]+고등학교/);
    if (sm && (!schoolName || sm[0].length > schoolName.length)) schoolName = sm[0];
    // 이름: '성명: 홍길동' / '이름 홍길동' 라벨 기반
    const nm = line.match(/(?:성\s*명|이\s*름)\s*[:：]?\s*([가-힣]{2,5})/);
    if (nm && !studentName) studentName = nm[1];
    // 발급년도: 2000~2099 네 자리
    const ym = line.match(/20\d{2}/);
    if (ym) {
      const y = parseInt(ym[0], 10);
      if (!issueYear || y > issueYear) issueYear = y;  // 가장 최근 연도 채택
    }
  }
  return { schoolName, studentName, issueYear };
}
