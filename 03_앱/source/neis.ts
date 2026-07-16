// lib/neis.ts — NEIS 급식·학사일정·시간표 서비스 (neis-core.mjs 미러)
// 키가 없으면 목업으로 폴백 → Expo Go에서 바로 데모 가능.

import Constants from 'expo-constants';

const KEY: string = (Constants.expoConfig?.extra as any)?.NEIS_API_KEY ?? '';
const BASE = 'https://open.neis.go.kr/hub';

// 2027학년도 수능 = 2026-11-19(목). 평가원 시행세부계획 2026-07-01 공고로 확정.
export const SUNEUNG_DATE = '2026-11-19';

export type School = {
  school_code: string;        // SD_SCHUL_CODE
  office_code: string;        // ATPT_OFCDC_SC_CODE (시도교육청)
  school_name: string;
  grade?: number;
  class_nm?: string;
};

export type MealSlot = { name: string; menu: string[]; kcal: string };
export type ScheduleEvent = { date: string; title: string };
export type TimetableItem = { period: number; subject: string };

// ── 공통 fetch ────────────────────────────────────────────────
async function neis(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ KEY, Type: 'json', pIndex: '1', pSize: '100', ...params });
  const res = await fetch(`${BASE}/${endpoint}?${qs}`);
  const json = await res.json();
  if (json.RESULT?.CODE === 'INFO-200') return []; // 데이터 없음
  const block = json[endpoint];
  return block?.[1]?.row ?? [];
}

const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// 알레르기 번호 · 잔여기호 정제: "김치찌개 (5.9.13.)" → "김치찌개"
const cleanDish = (s: string) =>
  s.replace(/\([\d.\s]+\)/g, '').replace(/\d+\./g, '').trim();

// ── 급식 (mealServiceDietInfo) ────────────────────────────────
export async function fetchMeal(school: School, date = new Date()): Promise<MealSlot[]> {
  if (!KEY) return mockMeal();
  try {
    const rows = await neis('mealServiceDietInfo', {
      ATPT_OFCDC_SC_CODE: school.office_code,
      SD_SCHUL_CODE: school.school_code,
      MLSV_YMD: ymd(date),
    });
    if (!rows.length) return [];
    return rows.map((r: any) => ({
      name: r.MMEAL_SC_NM,                          // 조식/중식/석식
      menu: String(r.DDISH_NM).split(/<br\s*\/?>/i).map(cleanDish).filter(Boolean),
      kcal: String(r.CAL_INFO ?? '').replace('Kcal', 'kcal').trim(),
    }));
  } catch {
    return [];
  }
}

// ── 학사일정 (SchoolSchedule) + D-day ─────────────────────────
export async function fetchSchedule(school: School, days = 60): Promise<ScheduleEvent[]> {
  if (!KEY) return mockSchedule();
  const from = new Date();
  const to = new Date(Date.now() + days * 864e5);
  try {
    const rows = await neis('SchoolSchedule', {
      ATPT_OFCDC_SC_CODE: school.office_code,
      SD_SCHUL_CODE: school.school_code,
      AA_FROM_YMD: ymd(from),
      AA_TO_YMD: ymd(to),
    });
    return rows.map((r: any) => ({
      date: `${r.AA_YMD.slice(0, 4)}-${r.AA_YMD.slice(4, 6)}-${r.AA_YMD.slice(6, 8)}`,
      title: r.EVENT_NM,
    }));
  } catch {
    return [];
  }
}

// KST 자정 기준 D-day (음수면 지난 일정)
export function dday(dateISO: string): number {
  const today = new Date();
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = dateISO.split('-').map(Number);
  const t1 = Date.UTC(y, m - 1, d);
  return Math.round((t1 - t0) / 864e5);
}

// 가장 가까운 시험 일정 1개 (중간/기말/시험 키워드)
export function nextExam(events: ScheduleEvent[]): (ScheduleEvent & { d: number }) | null {
  const cand = events
    .filter((e) => /시험|중간|기말|고사/.test(e.title))
    .map((e) => ({ ...e, d: dday(e.date) }))
    .filter((e) => e.d >= 0)
    .sort((a, b) => a.d - b.d);
  return cand[0] ?? null;
}

// ── 시간표 (hisTimetable, 고등학교) ───────────────────────────
export async function fetchTimetable(school: School, date = new Date()): Promise<TimetableItem[]> {
  if (!KEY || !school.grade) return mockTimetable();
  try {
    const rows = await neis('hisTimetable', {
      ATPT_OFCDC_SC_CODE: school.office_code,
      SD_SCHUL_CODE: school.school_code,
      GRADE: String(school.grade),
      CLASS_NM: school.class_nm ?? '1',
      ALL_TI_YMD: ymd(date),
    });
    return rows
      .map((r: any) => ({ period: Number(r.PERIO), subject: cleanDish(r.ITRT_CNTNT) }))
      .sort((a: TimetableItem, b: TimetableItem) => a.period - b.period);
  } catch {
    return [];
  }
}

// ── 목업 (키 없을 때 데모) ────────────────────────────────────
const mockMeal = (): MealSlot[] => [
  { name: '중식', menu: ['흑미밥', '소고기무국', '제육볶음', '배추김치', '요구르트'], kcal: '812.3 kcal' },
];
const mockSchedule = (): ScheduleEvent[] => {
  const plus = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  return [
    { date: plus(12), title: '1학기 중간고사' },
    { date: plus(30), title: '체육대회' },
  ];
};
const mockTimetable = (): TimetableItem[] => [
  { period: 1, subject: '국어' }, { period: 2, subject: '수학' },
  { period: 3, subject: '영어' }, { period: 4, subject: '통합사회' },
  { period: 5, subject: '한국사' }, { period: 6, subject: '체육' },
];
