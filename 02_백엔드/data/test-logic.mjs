// test-logic.mjs — verify-student-id/logic.ts 판정 로직 테스트
// 실행: node --experimental-strip-types test-logic.mjs  (Node 22.6+)
import {
  normalizeSchoolName, matchSchoolName, issueYearOk, decideAuto, identityHash, extractFields,
} from "./verify-student-id/logic.ts";

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

// ── 학교명 대조 ──
eq("완전일치", matchSchoolName("상록고등학교", "상록고등학교"), "exact");
eq("공백 차이 흡수", matchSchoolName("상록 고등학교", "상록고등학교"), "exact");
eq("'고' 축약 흡수", matchSchoolName("상록고", "상록고등학교"), "exact");
eq("괄호 병기 흡수", matchSchoolName("상록고등학교(안산)", "상록고등학교"), "exact");
eq("부분일치(분교 등)", matchSchoolName("한국제일상록고등학교", "상록고등학교"), "partial");
eq("타교 불일치", matchSchoolName("단원고등학교", "상록고등학교"), "mismatch");
eq("OCR 빈 값", matchSchoolName("", "상록고등학교"), "mismatch");

// ── 발급년도 ──
eq("올해 발급 OK", issueYearOk(2026, 2026), true);
eq("2년 전 발급 OK(3학년)", issueYearOk(2024, 2026), true);
eq("3년 전 발급 → 졸업생 의심", issueYearOk(2023, 2026), false);
eq("연도 미추출 → 판단불가", issueYearOk(null, 2026), null);

// ── 자동 승인 매트릭스 ──
eq("고신뢰 완전일치 → 자동승인",
  decideAuto({ match: "exact", ocrConfidence: 0.95, issueYearCheck: true, hasStudentName: true }).action,
  "auto_approve");
eq("타교 학생증 → 자동거절",
  decideAuto({ match: "mismatch", ocrConfidence: 0.99, issueYearCheck: true, hasStudentName: true }).action,
  "auto_reject");
eq("저신뢰 → 사람검수",
  decideAuto({ match: "exact", ocrConfidence: 0.6, issueYearCheck: true, hasStudentName: true }).action,
  "review");
eq("옛 학생증 → 사람검수(자동승인 금지)",
  decideAuto({ match: "exact", ocrConfidence: 0.95, issueYearCheck: false, hasStudentName: true }).action,
  "review");

// ── 해시 ──
const h1 = await identityHash("홍길동", "9000001", "pepper-secret");
const h2 = await identityHash("홍 길 동", "9000001", "pepper-secret");   // 공백 우회 시도
const h3 = await identityHash("홍길동", "9000001", "different-pepper");
eq("공백 우회해도 동일 해시", h1 === h2, true);
eq("pepper 다르면 다른 해시", h1 !== h3, true);
eq("해시 길이 64(sha256 hex)", h1.length, 64);

// ── OCR 필드 추출 ──
const f = extractFields(["학생증", "상록고등학교", "성명: 김범수", "2025. 03. 02 발급", "제 2025-133호"]);
eq("학교명 추출", f.schoolName, "상록고등학교");
eq("이름 추출", f.studentName, "김범수");
eq("발급년도 추출", f.issueYear, 2025);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
