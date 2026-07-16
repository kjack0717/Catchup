// lib/verification.ts — 학생증 인증 제출 (verify-student-id Edge Function seam)
// 배포 후: 이미지 업로드 → OCR(CLOVA) → 판정(logic.ts) → 검수 큐 → 승인/반려.
// 지금: Edge Function 미배포 상태이므로 2초 뒤 승인되는 데모 시뮬레이션.

import type { SchoolHit } from './schools';

export type VerifyRequest = {
  school: SchoolHit;
  name: string;          // 학생증 상 이름 (실명)
  grade: number;         // 1~3
  imageUri: string | null; // 학생증 이미지 (데모에선 없이도 진행 허용)
};

export type VerifyResult =
  | { status: 'approved' }
  | { status: 'rejected'; reason: string }
  | { status: 'pending' };

export async function submitVerification(req: VerifyRequest): Promise<VerifyResult> {
  // 실제 구현(배포 시):
  //   1) supabase.storage 업로드 (student-ids 버킷, 30일 자동 파기 정책)
  //   2) supabase.functions.invoke('verify-student-id', { body: {...} })
  //      → OCR 학교명·이름 대조, identity_hash(HMAC+pepper) 중복가입 검사
  //   3) 자동판정 실패 시 검수 큐(AdminReview) → 푸시로 결과 통지
  await new Promise((r) => setTimeout(r, 2000)); // 검수 시뮬레이션

  if (!req.name.trim()) return { status: 'rejected', reason: '이름을 확인할 수 없어요.' };
  return { status: 'approved' };
}
