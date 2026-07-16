// lib/community.ts — 커뮤니티 데이터 계층 (core-spec §2)
// 키 없으면 목업으로 완전 인터랙티브. 키 있으면 posts 테이블(RLS 학교격리) 사용.

import { supabase } from './supabaseClient';
import type { School } from './neis';

export const TAGS = ['잡담', '입시정보', '분실물', '수행평가', '학교'] as const;
export type Tag = (typeof TAGS)[number];

export type Post = {
  id: string;
  tag: Tag;
  isAnonymous: boolean;
  authorLabel: string;    // 실명 닉네임 or '익명'
  isGraduate?: boolean;   // 학사모 (실명 글에만, core-spec §2.7)
  body: string;
  likes: number;
  comments: number;
  liked: boolean;
  scrapped: boolean;
  createdAt: string;      // ISO
};

// ── 게시 전 AI 필터 seam (core-spec §6-4-1) ───────────────────
// 실제 배포: verify/ai-filter Edge Function 호출 → safe/warn/block.
// 지금은 통과(safe) 스텁. block이면 게시 차단, warn이면 경고 후 게시.
export type PreCheck = { verdict: 'safe' | 'warn' | 'block'; reason?: string };
export async function preCheckPost(_body: string): Promise<PreCheck> {
  return { verdict: 'safe' };
}

// ── 목업 시드 ─────────────────────────────────────────────────
const mins = (n: number) => new Date(Date.now() - n * 60000).toISOString();
let seq = 1000;
const nextId = () => `p_${seq++}`;

const MOCK: Post[] = [
  { id: nextId(), tag: '입시정보', isAnonymous: false, authorLabel: '3학년김',
    body: '이번 중간 시험범위 정리해서 공유합니다. 사문은 3단원까지래요.',
    likes: 24, comments: 8, liked: false, scrapped: false, createdAt: mins(35) },
  { id: nextId(), tag: '잡담', isAnonymous: true, authorLabel: '익명',
    body: '오늘 급식 제육 실화냐… 한 번 더 받으러 감',
    likes: 17, comments: 12, liked: true, scrapped: false, createdAt: mins(72) },
  { id: nextId(), tag: '분실물', isAnonymous: false, authorLabel: '민서', isGraduate: false,
    body: '3반 앞에서 검정 우산 주웠어요. 학생회실에 맡겨둠!',
    likes: 9, comments: 3, liked: false, scrapped: true, createdAt: mins(140) },
  { id: nextId(), tag: '학교', isAnonymous: false, authorLabel: '07졸업생', isGraduate: true,
    body: '후배들 화이팅. 수능 얼마 안 남았다 힘내라 🔥',
    likes: 41, comments: 6, liked: false, scrapped: false, createdAt: mins(300) },
];

// ── 목록 ──────────────────────────────────────────────────────
export async function fetchPosts(school: School, tag?: Tag): Promise<Post[]> {
  if (!supabase) {
    const list = tag ? MOCK.filter((p) => p.tag === tag) : MOCK;
    return [...list];
  }
  let q = supabase
    .from('posts')
    .select('*')
    .eq('school_code', school.school_code)
    .eq('blinded', false)
    .order('created_at', { ascending: false });
  if (tag) q = q.eq('tag', tag);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id, tag: r.tag, isAnonymous: r.is_anonymous,
    authorLabel: r.is_anonymous ? '익명' : r.author_nickname,
    isGraduate: r.author_is_graduate, body: r.body,
    likes: r.like_count ?? 0, comments: r.comment_count ?? 0,
    liked: false, scrapped: false, createdAt: r.created_at,
  }));
}

// ── 작성 ──────────────────────────────────────────────────────
export async function createPost(
  opts: { tag: Tag; body: string; isAnonymous: boolean; nickname: string; isGraduate?: boolean }
): Promise<Post> {
  const post: Post = {
    id: nextId(), tag: opts.tag, isAnonymous: opts.isAnonymous,
    authorLabel: opts.isAnonymous ? '익명' : opts.nickname,
    isGraduate: opts.isAnonymous ? undefined : opts.isGraduate,
    body: opts.body.trim(), likes: 0, comments: 0,
    liked: false, scrapped: false, createdAt: new Date().toISOString(),
  };
  // 실제: supabase.from('posts').insert(...) → RLS가 school_code 강제.
  return post;
}

// 상대 시간 표기
export function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
