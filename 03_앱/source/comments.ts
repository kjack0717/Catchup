// lib/comments.ts — 댓글/대댓글 + 익명 순번 (core-spec §2.2)

import type { Post } from './community';

export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;  // null = 댓글, 값 있으면 대댓글(1-depth)
  authorId: string;
  isAnonymous: boolean;
  authorNickname?: string;  // 실명일 때 표시
  body: string;
  createdAt: string;
};

let cseq = 5000;
const cid = () => `c_${cseq++}`;
const mins = (n: number) => new Date(Date.now() - n * 60000).toISOString();

// 목업 댓글 (post별)
const MOCK: Record<string, Comment[]> = {
  p_seed1: [
    { id: cid(), postId: 'p_seed1', parentId: null, authorId: 'u_x', isAnonymous: true, body: '오 감사합니다 ㅜㅜ', createdAt: mins(30) },
    { id: cid(), postId: 'p_seed1', parentId: null, authorId: 'u_kim', isAnonymous: false, authorNickname: '3학년김', body: '도움 됐다니 다행!', createdAt: mins(28) },
    { id: cid(), postId: 'p_seed1', parentId: null, authorId: 'u_x', isAnonymous: true, body: '혹시 수학은요?', createdAt: mins(25) },
  ],
  p_seed2: [
    { id: cid(), postId: 'p_seed2', parentId: null, authorId: 'u_y', isAnonymous: true, body: 'ㄹㅇ 오늘 맛있었음', createdAt: mins(60) },
    { id: cid(), postId: 'p_seed2', parentId: null, authorId: 'u_a', isAnonymous: true, body: '그니까 두 번 받았잖아', createdAt: mins(58) },
  ],
  p_seed4: [
    { id: cid(), postId: 'p_seed4', parentId: null, authorId: 'u_z', isAnonymous: false, authorNickname: '지훈', body: '감사합니다 선배님!', createdAt: mins(290) },
  ],
};

export async function fetchComments(postId: string): Promise<Comment[]> {
  return [...(MOCK[postId] ?? [])];
}

export async function addComment(
  postId: string,
  opts: { parentId: string | null; userId: string; isAnonymous: boolean; nickname: string; body: string }
): Promise<Comment> {
  return {
    id: cid(), postId, parentId: opts.parentId, authorId: opts.userId,
    isAnonymous: opts.isAnonymous, authorNickname: opts.isAnonymous ? undefined : opts.nickname,
    body: opts.body.trim(), createdAt: new Date().toISOString(),
  };
}

// ── 익명 순번 라벨 계산 (core-spec §2.2) ──────────────────────
// - 글 작성자(OP)가 익명이면 그 글 안에서 '글쓴이'로 고정 표기
// - OP가 실명이면 OP는 자기 닉네임
// - OP가 아닌 익명 댓글러는 등장 순서대로 익명1, 익명2…
// - 실명 댓글러는 자기 닉네임
// - 같은 사람은 그 글 안에서 같은 라벨 유지
export function buildAnonLabels(post: Post, comments: Comment[]): Record<string, string> {
  const map: Record<string, string> = {};
  map[post.authorId] = post.isAnonymous ? '글쓴이' : post.authorLabel;
  let n = 0;
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of ordered) {
    if (map[c.authorId]) continue;              // OP거나 이미 라벨 부여됨
    if (c.isAnonymous) map[c.authorId] = `익명${++n}`;
    else map[c.authorId] = c.authorNickname ?? '이용자';
  }
  return map;
}
