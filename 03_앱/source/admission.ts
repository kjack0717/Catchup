// lib/admission.ts — 입시 탭 데이터·계산 (core-spec §3)

// ── 내신 등급 계산기 (단순형: 가중평균) ──────────────────────
export type GpaRow = {
  id: string;
  name: string;
  units: number;   // 단위수
  grade: number;   // 등급 1~9
  include: boolean;
};

let rseq = 1;
export const newRow = (name = '', units = 3, grade = 3): GpaRow =>
  ({ id: `r_${rseq++}`, name, units, grade, include: true });

export const seedRows = (): GpaRow[] => [
  newRow('국어', 4, 2), newRow('수학', 4, 3), newRow('영어', 4, 2),
  newRow('한국사', 3, 1), newRow('통합사회', 3, 2), newRow('통합과학', 3, 3),
];

export function computeGpa(rows: GpaRow[]) {
  const inc = rows.filter((r) => r.include && r.units > 0);
  const totalUnits = inc.reduce((s, r) => s + r.units, 0);
  const weighted = inc.reduce((s, r) => s + r.grade * r.units, 0);
  return {
    avg: totalUnits ? weighted / totalUnits : 0,
    totalUnits,
    count: inc.length,
  };
}

// ── 모의고사 등급컷 (예시 · 시즌마다 갱신) ────────────────────
// 반자동: 시즌마다 AI 프롬프트/운영자가 원점수 컷 갱신 (core-spec §3-2)
export const MOCK_CUTS = {
  label: '2026 예시 · 시행 시즌마다 갱신 필요',
  subjects: [
    { name: '국어', cuts: [['1등급', '84+'], ['2등급', '77~83'], ['3등급', '68~76']] },
    { name: '수학', cuts: [['1등급', '82+'], ['2등급', '74~81'], ['3등급', '65~73']] },
    { name: '영어(절대)', cuts: [['1등급', '90+'], ['2등급', '80~89'], ['3등급', '70~79']] },
  ],
};

// ── 대학 모집요강 링크 ────────────────────────────────────────
// 직접 URL은 매년 바뀌어 유지가 어려우므로(크롤링/자동팔로우 ⛔),
// 대학별 "입학처 모집요강" 검색 링크로 항상 최신을 열게 한다.
export const UNIVERSITIES = [
  '서울대학교', '연세대학교', '고려대학교', '성균관대학교', '한양대학교',
  '서강대학교', '중앙대학교', '경희대학교', '한국외국어대학교', '서울시립대학교',
  '이화여자대학교', '건국대학교', '동국대학교', '홍익대학교', '국민대학교',
  '숭실대학교', '세종대학교', '아주대학교', '인하대학교', 'KAIST',
];

export function admissionSearchUrl(univ: string): string {
  const q = encodeURIComponent(`${univ} 입학처 모집요강`);
  return `https://search.naver.com/search.naver?query=${q}`;
}
