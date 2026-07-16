/**
 * 모의 NEIS 서버 — ingest-schools.mjs --mock 전용
 * 2025 교육통계 분포를 재현한 합성 고교 2,412건 생성.
 * 검증 포인트: ①페이지네이션(1000건 단위 3페이지) ②중복 5건 주입 ③HS_SC_NM 누락 엣지케이스 ④17개 시도 커버리지
 */

// 2026-07-01 전남광주통합특별시 출범 반영 — 광주/전남이 통합시 분리표기로 내려옴
const SIDOS = [
  ["B10", "서울특별시"], ["C10", "부산광역시"], ["D10", "대구광역시"], ["E10", "인천광역시"],
  ["F10", "전남광주통합특별시(광주)"], ["G10", "대전광역시"], ["H10", "울산광역시"], ["I10", "세종특별자치시"],
  ["J10", "경기도"], ["K10", "강원특별자치도"], ["M10", "충청북도"], ["N10", "충청남도"],
  ["P10", "전북특별자치도"], ["Q10", "전남광주통합특별시(전남)"], ["R10", "경상북도"], ["S10", "경상남도"], ["T10", "제주특별자치도"],
];

// 유형별 목표 건수 (2026 — 자사고→일반고 전환 반영)
const TYPE_PLAN = [
  ["일반고", 1642], ["특성화고", 490], ["특목고", 160], ["자율고", 112],
  ["__방통고__", 15], ["__대안__", 10],   // HS_SC_NM 누락 엣지케이스 (이름 휴리스틱으로 분류돼야 함)
];

function buildDataset() {
  const rows = [];
  let seq = 7000001;
  for (const [type, count] of TYPE_PLAN) {
    for (let i = 0; i < count; i++) {
      const [officeCode, sido] = SIDOS[i % SIDOS.length];
      let name, hs;
      if (type === "__방통고__") { name = `${sido.slice(0, 2)}방송통신고등학교${i}`; hs = null; }
      else if (type === "__대안__") { name = `${sido.slice(0, 2)}학력인정대안학교${i}`; hs = null; }
      else { name = `${sido.slice(0, 2)}${type}${i}고등학교`; hs = type; }
      rows.push({
        ATPT_OFCDC_SC_CODE: officeCode,
        SD_SCHUL_CODE: String(seq++),
        SCHUL_NM: name,
        ENG_SCHUL_NM: `Mock High School ${seq}`,
        SCHUL_KND_SC_NM: "고등학교",
        LCTN_SC_NM: sido,
        FOND_SC_NM: i % 3 === 0 ? "사립" : "공립",
        ORG_RDNMA: `${sido} 모의로 ${i}길`,
        HMPG_ADRES: `http://school${seq}.hs.kr`,
        COEDU_SC_NM: i % 2 === 0 ? "남여공학" : "남",
        HS_SC_NM: hs,
      });
    }
  }
  // 중복 5건 주입 (페이지 경계에서 이중 수신되는 실서버 케이스 재현)
  rows.push(...rows.slice(0, 5));
  return rows;
}

const DATASET = buildDataset();

export async function mockFetch(url) {
  const u = new URL(url);
  const pIndex = Number(u.searchParams.get("pIndex"));
  const pSize = Number(u.searchParams.get("pSize"));
  const start = (pIndex - 1) * pSize;
  const rows = DATASET.slice(start, start + pSize);
  const body = rows.length === 0
    ? { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } }
    : {
        schoolInfo: [
          { head: [{ list_total_count: DATASET.length }, { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } }] },
          { row: rows },
        ],
      };
  return { ok: true, json: async () => body };
}
